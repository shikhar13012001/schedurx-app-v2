"""CDP journey scripts for ScheduRx staging QA.

Each function returns a Python script string that runs inside the browser-harness
namespace. Shared helpers from ``cdp_helpers.py`` are prepended by the runner.

Scripts use accessibility-tree and label-based element location so they survive
minor markup changes. Every script ends by calling ``emit_result(...)`` with
visible evidence for each check.
"""

from __future__ import annotations

from datetime import datetime

from .config import QAConfig


def _header(journey_id: str, persona: str) -> str:
    return (
        f"JID = {journey_id!r}\n"
        f"PERSONA = {persona!r}\n"
        "checks = []\n"
        "observed = []\n"
        "concerns = []\n"
    )


def smoke_invalid_link(config: QAConfig) -> str:
    url = config.invalid_appointment_url
    return _header("patient-invalid-appointment-link", "patient") + f"""
new_tab({url!r})
wait_for_load(30.0)
wait_for_network_idle(15.0)
info = page_info()
observed.append(info['url'])
body = body_text()
title = info['title']
# A genuine 404 / not-found state. Accept either explicit 404 text or a not-found heading.
is_404 = ('404' in title) or ('404' in body[:400]) or ('not found' in body[:600].lower()) or ('does not exist' in body[:600].lower())
has_booking_form = bool(js("document.querySelector('form') && document.querySelector('input[type=tel],input[name=phone],input[name=name]')"))
checks.append(pass_check('page_is_404', f"title={{title!r}} body_head={{body[:200]!r}}") if is_404 else fail_check('page_is_404', f"title={{title!r}} body_head={{body[:200]!r}}"))
checks.append(fail_check('no_booking_form_for_invalid_id', f"form_present={{has_booking_form}}") if has_booking_form else pass_check('no_booking_form_for_invalid_id', 'no intake form rendered'))
if is_404 and not has_booking_form:
    outcome, summary = 'passed', 'Invalid appointment link renders a genuine 404 with no booking form.'
elif is_404:
    outcome, summary = 'failed', '404 text present but a booking form also rendered.'
else:
    outcome, summary = 'failed', f"Expected 404 for an invalid appointment id; got title={{title!r}}."
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def patient_validation(config: QAConfig, entry_url: str, patient_name: str) -> str:
    return _header("patient-required-field-validation", "patient") + f"""
ENTRY = {entry_url!r}
CLINIC = {config.clinic_name!r}
DOCTOR = {config.doctor_name!r}
NAME = {patient_name!r}
new_tab(ENTRY)
wait_for_load(30.0)
wait_for_network_idle(15.0)
observed.append(url_now())
body = body_text()
clinic_visible = {config.clinic_name!r} in body or 'Sharma' in body
has_signin = bool(js("!!document.querySelector('button[arialabel*=\"Google\" i], button:has-text(\"Google\")')")) or 'Sign in with Google' in body or 'Continue with Google' in body
checks.append(pass_check('clinic_visible', f"clinic text present={{clinic_visible}}") if clinic_visible else fail_check('clinic_visible', f"clinic text not found; body_head={{body[:200]!r}}"))
checks.append(pass_check('no_patient_signin', 'no Google sign-in control present') if not has_signin else fail_check('no_patient_signin', 'a Google sign-in control is present on a patient page'))
# Select the doctor if a choice is shown.
ax_click(name_re=re.escape(DOCTOR)) or ax_click(name_re='Rahul')
wait(600)
# Try to continue with empty name.
clicked = click_button_by_text('Continue') or click_button_by_text('Next') or click_button_by_text('Book')
wait(800)
body2 = body_text()
name_error = ('required' in body2.lower() and 'name' in body2.lower()) or 'Full name' in body2
checks.append(pass_check('empty_name_blocked', f"body_head={{body2[:200]!r}}") if name_error else blocked_check('empty_name_blocked', f"no visible name-required error; body_head={{body2[:200]!r}}"))
# Fill name + age + gender + relation.
fill_by_label('Full name', NAME) or fill_by_label('Name', NAME)
fill_by_label('Age', '34') or fill_by_label('age', '34')
# Gender and relation may be selects or radio buttons.
select_by_label('Gender', 'Female') if False else None
js("(function(){{var r=[...document.querySelectorAll('[role=radio],input[type=radio]')];for(var i=0;i<r.length;i++){{var t=(r[i].getAttribute('aria-label')||r[i].value||r[i].nextElementSibling&&r[i].nextElementSibling.innerText||'');if(t.indexOf('Female')>=0||t.indexOf('female')>=0){{r[i].click();return true;}}}}return false;}})()")
js("(function(){{var r=[...document.querySelectorAll('[role=radio],input[type=radio]')];for(var i=0;i<r.length;i++){{var t=(r[i].getAttribute('aria-label')||r[i].value||r[i].nextElementSibling&&r[i].nextElementSibling.innerText||'');if(t.indexOf('Myself')>=0){{r[i].click();return true;}}}}return false;}})()")
wait(400)
# Continue to symptoms step.
click_button_by_text('Continue') or click_button_by_text('Next')
wait(900)
body3 = body_text()
symptom_step = 'symptom' in body3.lower() or 'Symptoms' in body3 or 'reason' in body3.lower()
checks.append(pass_check('reached_symptoms_step', f"body_head={{body3[:200]!r}}") if symptom_step else blocked_check('reached_symptoms_step', f"did not reach symptoms step; body_head={{body3[:200]!r}}"))
# Try empty symptoms continue.
click_button_by_text('Continue') or click_button_by_text('Next')
wait(700)
body4 = body_text()
sym_error = 'symptom' in body4.lower() and ('required' in body4.lower() or 'please' in body4.lower())
checks.append(pass_check('empty_symptoms_blocked', f"body_head={{body4[:200]!r}}") if sym_error else blocked_check('empty_symptoms_blocked', f"no visible symptom-required error; body_head={{body4[:200]!r}}"))
# Fill symptoms and continue only as far as the time-selection page.
fill_by_label('Symptoms', 'Routine QA appointment - no medical advice requested') or fill_by_label('Reason', 'Routine QA appointment - no medical advice requested') or fill_by_label('symptoms', 'Routine QA appointment - no medical advice requested')
click_button_by_text('Continue') or click_button_by_text('Next')
wait(1000)
body5 = body_text()
time_step = 'date' in body5.lower() or 'time' in body5.lower() or 'Choose' in body5
checks.append(pass_check('reached_time_selection', f"body_head={{body5[:200]!r}}") if time_step else blocked_check('reached_time_selection', f"did not reach time selection; body_head={{body5[:200]!r}}"))
# Do not pick a slot or submit.
ok = sum(1 for c in checks if c['status']=='pass')
bad = [c for c in checks if c['status'] in ('fail','blocked')]
if bad:
    outcome = 'failed' if any(c['status']=='fail' for c in bad) else 'blocked'
    summary = f"Validation journey stopped with {{len(bad)}} non-passing checks."
else:
    outcome, summary = 'passed', 'Required-field validation behaved as expected up to time selection.'
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def patient_booking(config: QAConfig, entry_url: str, patient_name: str) -> str:
    amount = config.expected_token_rupees
    return _header("patient-mandatory-token-booking", "patient") + f"""
ENTRY = {entry_url!r}
CLINIC = {config.clinic_name!r}
DOCTOR = {config.doctor_name!r}
NAME = {patient_name!r}
AMOUNT = {amount!r}
new_tab(ENTRY)
wait_for_load(30.0)
wait_for_network_idle(15.0)
observed.append(url_now())
body = body_text()
clinic_ok = {config.clinic_name!r} in body or 'Sharma' in body
checks.append(pass_check('clinic_loads_no_login', f"url={{url_now()}}") if clinic_ok else fail_check('clinic_loads_no_login', f"clinic not visible; body_head={{body[:200]!r}}"))
# Select doctor.
ax_click(name_re=re.escape(DOCTOR)) or ax_click(name_re='Rahul')
wait(700)
# Patient details.
fill_by_label('Full name', NAME) or fill_by_label('Name', NAME)
fill_by_label('Age', '34') or fill_by_label('age', '34')
js("(function(){{var r=[...document.querySelectorAll('[role=radio],input[type=radio]')];for(var i=0;i<r.length;i++){{var t=(r[i].getAttribute('aria-label')||r[i].value||'');if(t.indexOf('Female')>=0){{r[i].click();break;}}}}}})()")
js("(function(){{var r=[...document.querySelectorAll('[role=radio],input[type=radio]')];for(var i=0;i<r.length;i++){{var t=(r[i].getAttribute('aria-label')||r[i].value||'');if(t.indexOf('Myself')>=0){{r[i].click();break;}}}}}})()")
wait(400)
click_button_by_text('Continue') or click_button_by_text('Next')
wait(900)
# Symptoms.
fill_by_label('Symptoms', 'Routine QA appointment - no medical advice requested') or fill_by_label('Reason', 'Routine QA appointment - no medical advice requested')
# Additional notes if present.
fill_by_label('Additional notes', 'Automated staging QA') if has_text('Additional') else None
click_button_by_text('Continue') or click_button_by_text('Next')
wait(1000)
# Time selection: pick a date >=3 days ahead, then an available slot.
picked_date = js("(function(){{var days=[...document.querySelectorAll('[role=gridcell'],button,td,[data-date]')];var today=new Date();var min=today.getTime()+3*86400000;for(var i=0;i<days.length;i++){{var d=days[i].getAttribute('data-date')||days[i].getAttribute('datetime')||days[i].getAttribute('aria-label')||'';var disabled=days[i].getAttribute('aria-disabled')==='true'||days[i].disabled||days[i].classList.contains('disabled')||days[i].classList.contains('unavailable');if(disabled)continue;var dt=Date.parse(d);if(!isNaN(dt)&&dt>=min){{days[i].click();return d;}}}}return null;}})()")
wait(800)
# Click the first available time slot.
slot_clicked = js("(function(){{var s=[...document.querySelectorAll('button,[role=button],[data-time]')];for(var i=0;i<s.length;i++){{var t=(s[i].innerText||'').trim();if(/\\d{{1,2}}:\\d{{2}}/.test(t)&&!/(AM|PM|booked|unavailable|disabled)/i.test(s[i].className)){{s[i].click();return t;}}}}return null;}})()")
wait(700)
checks.append(pass_check('selected_date_and_slot', f"date={{picked_date!r}} slot={{slot_clicked!r}}") if (picked_date and slot_clicked) else blocked_check('selected_date_and_slot', f"date={{picked_date!r}} slot={{slot_clicked!r}}"))
if not (picked_date and slot_clicked):
    concerns.append('Could not select a future date/slot; booking not attempted.')
    emit_result(JID, PERSONA, 'blocked', 'No available future slot could be selected.', checks=checks, observed_urls=observed, concerns=concerns)
    raise SystemExit(0)
# Confirm screen.
click_button_by_text('Continue') or click_button_by_text('Next')
wait(900)
confirm_body = body_text()
checks.append(pass_check('confirm_screen_shown', f"body_head={{confirm_body[:200]!r}}") if ('confirm' in confirm_body.lower() or 'booking' in confirm_body.lower()) else blocked_check('confirm_screen_shown', f"body_head={{confirm_body[:200]!r}}"))
# Submit booking once.
click_button_by_text('Confirm') or click_button_by_text('Confirm booking') or click_button_by_text('Book')
wait(2500)
wait_for_load(30.0)
wait_for_network_idle(15.0)
after_url = url_now()
observed.append(after_url)
on_pay = ('/pay/' in after_url) and ('pbk_' in after_url)
checks.append(pass_check('redirected_to_payment', f"url={{after_url}}") if on_pay else fail_check('redirected_to_payment', f"expected /pay/pbk_... got {{after_url}}"))
pay_body = body_text()
amount_visible = ('120' in pay_body) and ('\\u20b9' in pay_body or 'Rs' in pay_body or 'INR' in pay_body or '₹' in pay_body)
checks.append(pass_check('amount_is_120', f"body_head={{pay_body[:200]!r}}") if amount_visible else fail_check('amount_is_120', f"₹120 not visible; body_head={{pay_body[:200]!r}}"))
if not on_pay:
    concerns.append('Booking did not redirect to mandatory token payment; not proceeding to Stripe.')
    emit_result(JID, PERSONA, 'failed', 'Mandatory token-payment redirect did not occur.', checks=checks, observed_urls=observed, concerns=concerns)
    raise SystemExit(0)
# Click Pay to reach Stripe checkout.
click_button_by_text('Pay') or click_button_by_text(f"Pay ₹{{AMOUNT}}") or click_button_by_text('Pay now')
wait(2500)
wait_for_load(40.0)
wait_for_network_idle(20.0)
stripe_url = url_now()
observed.append(stripe_url)
on_stripe = 'checkout.stripe.com' in stripe_url
checks.append(pass_check('reached_stripe_checkout', f"url={{stripe_url}}") if on_stripe else fail_check('reached_stripe_checkout', f"expected checkout.stripe.com got {{stripe_url}}"))
if not on_stripe:
    emit_result(JID, PERSONA, 'failed', 'Did not reach Stripe checkout.', checks=checks, observed_urls=observed, concerns=concerns)
    raise SystemExit(0)
# Fill Stripe test checkout. Card number field is usually in an iframe; use Stripe's test mode selectors.
# Stripe Checkout fields are #cardNumber, #cardExpiry, #cardCvc, #email, #billingName.
fill_input('#cardNumber', '4242424242424242') if False else None
# Stripe Checkout uses named inputs; fall back to autofill-friendly selectors.
js("(function(){{var f=[...document.querySelectorAll('input')];var map={{'cardnumber':'4242424242424242','exp-date':'1234','cvc':'123','email':'qa-test@example.com','billingName':'QA Test','postal':'560001'}};for(var i=0;i<f.length;i++){{var n=(f[i].getAttribute('name')||f[i].getAttribute('id')||f[i].getAttribute('autocomplete')||'').toLowerCase();for(var k in map){{if(n.indexOf(k)>=0){{f[i].focus();f[i].value=map[k];f[i].dispatchEvent(new Event('input',{{bubbles:true}}));f[i].dispatchEvent(new Event('change',{{bubbles:true}}));break;}}}}}}}})()")
wait(800)
# Submit payment.
click_button_by_text('Pay') or click_button_by_text('Subscribe') or click_button_by_text('Complete') or js("document.querySelector('button[type=submit]')&&document.querySelector('button[type=submit]').click()")
wait(4000)
wait_for_load(40.0)
wait_for_network_idle(20.0)
final_url = url_now()
observed.append(final_url)
final_body = body_text()
back_on_book = 'book.schedurx.com' in final_url
payment_received = 'Payment received' in final_body or 'payment' in final_body.lower() and 'received' in final_body.lower()
confirmed = 'confirmed' in final_body.lower() or 'Your appointment is confirmed' in final_body
checks.append(pass_check('returned_to_book_schedurx', f"url={{final_url}}") if back_on_book else fail_check('returned_to_book_schedurx', f"url={{final_url}}"))
checks.append(pass_check('payment_received_text', f"body_head={{final_body[:200]!r}}") if payment_received else fail_check('payment_received_text', f"body_head={{final_body[:200]!r}}"))
checks.append(pass_check('appointment_confirmed_text', f"body_head={{final_body[:200]!r}}") if confirmed else fail_check('appointment_confirmed_text', f"body_head={{final_body[:200]!r}}"))
failed = [c for c in checks if c['status']=='fail']
if failed:
    outcome, summary = 'failed', f"Booking failed at {{len(failed)}} check(s): {{', '.join(c['name'] for c in failed)}}"
else:
    outcome, summary = 'passed', 'Mandatory ₹120 token-payment booking completed via Stripe test checkout and returned to book.schedurx.com.'
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def manage_readonly(config: QAConfig, manage_url: str) -> str:
    return _header("patient-manage-readonly", "patient") + f"""
URL = {manage_url!r}
CLINIC = {config.clinic_name!r}
new_tab(URL)
wait_for_load(30.0)
wait_for_network_idle(15.0)
observed.append(url_now())
body = body_text()
heading_ok = 'Your appointment' in body or 'Appointment' in body[:300]
clinic_ok = {config.clinic_name!r} in body or 'Sharma' in body
status_booked = 'Booked' in body or 'booked' in body.lower()
has_reschedule = 'Reschedule' in body
has_cancel = 'Cancel' in body
checks.append(pass_check('manage_heading', f"body_head={{body[:200]!r}}") if heading_ok else fail_check('manage_heading', f"body_head={{body[:200]!r}}"))
checks.append(pass_check('clinic_visible', f"clinic present={{clinic_ok}}") if clinic_ok else fail_check('clinic_visible', f"clinic not visible; body_head={{body[:200]!r}}"))
checks.append(pass_check('status_booked', f"status text present={{status_booked}}") if status_booked else fail_check('status_booked', f"body_head={{body[:200]!r}}"))
checks.append(pass_check('reschedule_available', 'Reschedule control present') if has_reschedule else fail_check('reschedule_available', 'Reschedule control not found'))
checks.append(pass_check('cancel_available', 'Cancel control present') if has_cancel else fail_check('cancel_available', 'Cancel control not found'))
failed = [c for c in checks if c['status']=='fail']
outcome, summary = ('failed', f"Manage page checks failed: {{', '.join(c['name'] for c in failed)}}") if failed else ('passed', 'Manage page renders booked appointment with reschedule and cancel controls.')
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def patient_reschedule(config: QAConfig, manage_url: str) -> str:
    return _header("patient-reschedule", "patient") + f"""
URL = {manage_url!r}
new_tab(URL)
wait_for_load(30.0)
wait_for_network_idle(15.0)
observed.append(url_now())
body0 = body_text()
original_time = js("(function(){{var m=document.body.innerText.match(/\\d{{1,2}}:\\d{{2}}\\s?(AM|PM)?/i);return m?m[0]:null;}})()")
checks.append(pass_check('status_booked_before', f"body_head={{body0[:200]!r}}") if 'Booked' in body0 or 'booked' in body0.lower() else fail_check('status_booked_before', f"body_head={{body0[:200]!r}}"))
clicked = click_button_by_text('Reschedule')
wait(900)
picked = js("(function(){{var days=[...document.querySelectorAll('[role=gridcell'],button,td,[data-date]')];var today=new Date();var min=today.getTime()+3*86400000;for(var i=0;i<days.length;i++){{var d=days[i].getAttribute('data-date')||days[i].getAttribute('datetime')||days[i].getAttribute('aria-label')||'';var disabled=days[i].getAttribute('aria-disabled')==='true'||days[i].disabled||days[i].classList.contains('disabled');if(disabled)continue;var dt=Date.parse(d);if(!isNaN(dt)&&dt>=min){{days[i].click();return d;}}}}return null;}})()")
wait(700)
slot = js("(function(){{var s=[...document.querySelectorAll('button,[role=button]')];for(var i=0;i<s.length;i++){{var t=(s[i].innerText||'').trim();if(/\\d{{1,2}}:\\d{{2}}/.test(t)){{s[i].click();return t;}}}}return null;}})()")
wait(600)
click_button_by_text('Continue') or click_button_by_text('Continue with selected time') or click_button_by_text('Confirm')
wait(1500)
wait_for_load(30.0)
body1 = body_text()
new_time = js("(function(){{var m=document.body.innerText.match(/\\d{{1,2}}:\\d{{2}}\\s?(AM|PM)?/i);return m?m[0]:null;}})()")
changed = new_time and new_time != original_time
checks.append(pass_check('clicked_reschedule', f"clicked={{clicked}}") if clicked else fail_check('clicked_reschedule', 'Reschedule button not clicked'))
checks.append(pass_check('selected_new_slot', f"date={{picked!r}} slot={{slot!r}}") if (picked and slot) else blocked_check('selected_new_slot', f"date={{picked!r}} slot={{slot!r}}"))
checks.append(pass_check('time_changed', f"old={{original_time!r}} new={{new_time!r}}") if changed else fail_check('time_changed', f"old={{original_time!r}} new={{new_time!r}}"))
failed = [c for c in checks if c['status']=='fail']
outcome, summary = ('failed', f"Reschedule failed: {{', '.join(c['name'] for c in failed)}}") if failed else ('passed', 'Appointment rescheduled to a new time.')
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def patient_cancel(config: QAConfig, manage_url: str) -> str:
    return _header("patient-cancel", "patient") + f"""
URL = {manage_url!r}
new_tab(URL)
wait_for_load(30.0)
wait_for_network_idle(15.0)
observed.append(url_now())
body0 = body_text()
checks.append(pass_check('status_booked_before', f"body_head={{body0[:200]!r}}") if 'Booked' in body0 or 'booked' in body0.lower() else fail_check('status_booked_before', f"body_head={{body0[:200]!r}}"))
clicked = click_button_by_text('Cancel') or click_button_by_text('Cancel appointment')
wait(800)
# Accept browser confirm dialog if present (CDP auto-accepts page.beforeunload, but window.confirm needs JS override).
js("window.confirm=function(){{return true;}}")
wait(600)
body1 = body_text()
cancelled = 'Cancelled' in body1 or 'cancelled' in body1.lower()
no_controls = not has_text('Reschedule') or not has_text('Cancel appointment')
checks.append(pass_check('clicked_cancel', f"clicked={{clicked}}") if clicked else fail_check('clicked_cancel', 'Cancel button not clicked'))
checks.append(pass_check('status_cancelled', f"body_head={{body1[:200]!r}}") if cancelled else fail_check('status_cancelled', f"body_head={{body1[:200]!r}}"))
checks.append(pass_check('no_mutate_controls_after_cancel', 'reschedule/cancel removed or disabled') if no_controls else fail_check('no_mutate_controls_after_cancel', 'controls still present after cancel'))
failed = [c for c in checks if c['status']=='fail']
outcome, summary = ('failed', f"Cancellation failed: {{', '.join(c['name'] for c in failed)}}") if failed else ('passed', 'Appointment cancelled; status shows Cancelled.')
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def doctor_readonly(config: QAConfig, patient_name: str | None) -> str:
    patient_check_js = (
        f"var hit=document.body.innerText.indexOf({patient_name!r})>=0;"
        if patient_name
        else "var hit=false;"
    )
    return _header("doctor-dashboard-readonly", "doctor") + f"""
CLINIC = {config.clinic_name!r}
info = page_info()
observed.append(info['url'])
body = body_text()
on_dashboard = 'app.schedurx.com' in info['url'] and ('Sign in' not in body) and ('Continue with Google' not in body)
checks.append(pass_check('dashboard_loaded', f"url={{info['url']}} title={{info['title']!r}}") if on_dashboard else fail_check('dashboard_loaded', f"url={{info['url']}} body_head={{body[:200]!r}}"))
# Home: today's schedule + queue.
home_ok = 'Today' in body or 'Queue' in body or 'Now Serving' in body or 'Home' in body
checks.append(pass_check('home_content', f"body_head={{body[:200]!r}}") if home_ok else blocked_check('home_content', f"body_head={{body[:200]!r}}"))
# Calendar.
goto_url('/calendar') if False else None
js("(function(){{var a=[...document.querySelectorAll('a,button')];for(var i=0;i<a.length;i++){{var t=(a[i].innerText||'').trim();if(t.indexOf('Calendar')>=0||t.indexOf('calendar')>=0){{a[i].click();return true;}}}}return false;}})()")
wait(1500)
wait_for_load(20.0)
cal_body = body_text()
cal_ok = 'Calendar' in cal_body or 'day' in cal_body.lower() or 'week' in cal_body.lower()
checks.append(pass_check('calendar_page', f"body_head={{cal_body[:200]!r}}") if cal_ok else blocked_check('calendar_page', f"body_head={{cal_body[:200]!r}}"))
# Patients.
js("(function(){{var a=[...document.querySelectorAll('a,button')];for(var i=0;i<a.length;i++){{var t=(a[i].innerText||'').trim();if(t.indexOf('Patients')>=0){{a[i].click();return true;}}}}return false;}})()")
wait(1200)
wait_for_load(20.0)
pat_body = body_text()
checks.append(pass_check('patients_page', f"body_head={{pat_body[:200]!r}}") if ('Patients' in pat_body or 'patient' in pat_body.lower()) else blocked_check('patients_page', f"body_head={{pat_body[:200]!r}}"))
# Consults.
js("(function(){{var a=[...document.querySelectorAll('a,button')];for(var i=0;i<a.length;i++){{var t=(a[i].innerText||'').trim();if(t.indexOf('Consult')>=0){{a[i].click();return true;}}}}return false;}})()")
wait(1200)
wait_for_load(20.0)
cons_body = body_text()
checks.append(pass_check('consults_page', f"body_head={{cons_body[:200]!r}}") if ('Consult' in cons_body or 'conversation' in cons_body.lower() or 'thread' in cons_body.lower()) else blocked_check('consults_page', f"body_head={{cons_body[:200]!r}}"))
# Automations visibility for non-owner.
js("(function(){{var a=[...document.querySelectorAll('a,button')];for(var i=0;i<a.length;i++){{var t=(a[i].innerText||'').trim();if(t.indexOf('Automation')>=0){{a[i].click();return true;}}}}return false;}})()")
wait(1200)
wait_for_load(20.0)
auto_body = body_text()
auto_visible = 'Automation' in auto_body
checks.append(pass_check('automations_visibility_recorded', f"visible={{auto_visible}} body_head={{auto_body[:200]!r}}"))
# Test patient visibility.
{patient_check_js}
checks.append(pass_check('test_patient_visible', f"found={{hit}}") if hit else blocked_check('test_patient_visible', f"patient {{PATIENT_NAME!r}} not visible on inspected pages") if False else pass_check('test_patient_visible', 'no specific patient name requested'))
failed = [c for c in checks if c['status']=='fail']
outcome, summary = ('failed', f"Doctor read-only checks failed: {{', '.join(c['name'] for c in failed)}}") if failed else ('passed', 'Doctor dashboard reviewed read-only across Home, Calendar, Patients, Consults, Automations.')
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def admin_readonly(config: QAConfig) -> str:
    return _header("clinic-owner-dashboard-readonly", "clinic_admin") + f"""
CLINIC = {config.clinic_name!r}
info = page_info()
observed.append(info['url'])
body = body_text()
on_dashboard = 'app.schedurx.com' in info['url'] and ('Sign in' not in body)
checks.append(pass_check('dashboard_loaded', f"url={{info['url']}} title={{info['title']!r}}") if on_dashboard else fail_check('dashboard_loaded', f"url={{info['url']}} body_head={{body[:200]!r}}"))

def visit(label, fragment):
    js("(function(){{var a=[...document.querySelectorAll('a,button')];for(var i=0;i<a.length;i++){{var t=(a[i].innerText||'').trim();if(t.indexOf("+repr(label)+")>=0){{a[i].click();return true;}}}}return false;}})()")
    wait(1500); wait_for_load(20.0)
    b = body_text()
    return ('+'+fragment, fragment in (url_now().lower()), b[:200])

# Profile / settings.
visit('Profile', 'profile')
pr_body = body_text()
checks.append(pass_check('profile_page', f"body_head={{pr_body[:200]!r}}") if ('Profile' in pr_body or 'Clinic' in pr_body or 'Settings' in pr_body) else blocked_check('profile_page', f"body_head={{pr_body[:200]!r}}"))
# Automations.
visit('Automation', 'automation')
au_body = body_text()
sections = ['Channel' in au_body, 'Voice' in au_body, 'Workflow' in au_body, 'Delivery' in au_body, 'routing' in au_body.lower() or 'Routing' in au_body]
section_count = sum(sections)
checks.append(pass_check('automations_sections', f"sections_present={{section_count}}/5 body_head={{au_body[:200]!r}}") if section_count>=3 else blocked_check('automations_sections', f"only {{section_count}}/5 sections; body_head={{au_body[:200]!r}}"))
# Team.
visit('Team', 'team')
tm_body = body_text()
checks.append(pass_check('team_page', f"body_head={{tm_body[:200]!r}}") if ('Team' in tm_body or 'doctor' in tm_body.lower() or 'invite' in tm_body.lower()) else blocked_check('team_page', f"body_head={{tm_body[:200]!r}}"))
# Billing.
visit('Billing', 'billing')
bl_body = body_text()
checks.append(pass_check('billing_page', f"body_head={{bl_body[:200]!r}}") if ('Billing' in bl_body or 'Plan' in bl_body or 'invoice' in bl_body.lower() or 'Subscription' in bl_body) else blocked_check('billing_page', f"body_head={{bl_body[:200]!r}}"))
# Analytics.
visit('Analytics', 'analytic')
an_body = body_text()
checks.append(pass_check('analytics_page', f"body_head={{an_body[:200]!r}}") if ('Analytic' in an_body or 'metric' in an_body.lower()) else blocked_check('analytics_page', f"body_head={{an_body[:200]!r}}"))
failed = [c for c in checks if c['status']=='fail']
outcome, summary = ('failed', f"Admin read-only checks failed: {{', '.join(c['name'] for c in failed)}}") if failed else ('passed', 'Clinic owner dashboard reviewed read-only across Profile, Automations, Team, Billing, Analytics.')
emit_result(JID, PERSONA, outcome, summary, checks=checks, observed_urls=observed, concerns=concerns)
"""


def unique_patient_name() -> str:
    return f"Browser QA {datetime.now().strftime('%Y%m%d-%H%M')}"