"""Shared helpers executed inside the browser-harness CDP context.

This module is NOT imported by the harness process directly. Its source is read
by the runner and prepended to every journey script before piping the script
into ``browser-harness``. The code below therefore runs in the browser-harness
namespace where ``new_tab``, ``page_info``, ``js``, ``cdp``, ``click_at_xy``,
``fill_input``, ``wait_for_load`` etc. are pre-imported.

It provides:
- ``emit_result(...)``: print a single ``JOURNEY_RESULT_JSON:`` line parsed by the runner.
- ``ax_find / ax_click / ax_center``: accessibility-tree based element location and clicking.
- ``body_text / has_text / has_url / url_now``: cheap visible-state assertions.
- ``fill_by_label / click_button_by_text``: form helpers that fall back from AX tree to CSS.
"""

from __future__ import annotations

import json as _json
import re as _re
import time as _time


def emit_result(
    journey_id: str,
    persona: str,
    outcome: str,
    summary: str,
    *,
    checks=None,
    observed_urls=None,
    created_records=None,
    concerns=None,
) -> None:
    payload = {
        "journey_id": journey_id,
        "persona": persona,
        "outcome": outcome,
        "summary": summary,
        "checks": checks or [],
        "observed_urls": observed_urls or [],
        "created_records": created_records or [],
        "concerns": concerns or [],
    }
    print("JOURNEY_RESULT_JSON:" + _json.dumps(payload, ensure_ascii=False))


def _check(name: str, status: str, evidence: str) -> dict:
    return {"name": name, "status": status, "evidence": evidence}


def pass_check(name: str, evidence: str) -> dict:
    return _check(name, "pass", evidence)


def fail_check(name: str, evidence: str) -> dict:
    return _check(name, "fail", evidence)


def blocked_check(name: str, evidence: str) -> dict:
    return _check(name, "blocked", evidence)


def url_now() -> str:
    return page_info()["url"]  # noqa: F821 - pre-imported in browser-harness


def title_now() -> str:
    return page_info()["title"]  # noqa: F821


def body_text() -> str:
    return js("document.body ? document.body.innerText : ''") or ""  # noqa: F821


def has_text(needle: str) -> bool:
    return needle in body_text()


def has_url(fragment: str) -> bool:
    return fragment in url_now()


def wait(ms: float = 500.0) -> None:
    _time.sleep(ms / 1000.0)


def ax_nodes():
    return cdp("Accessibility.getFullAXTree")["nodes"]  # noqa: F821


def ax_find(*, name=None, role=None, name_re=None, max_results=50):
    out = []
    for n in ax_nodes():
        r = (n.get("role", {}).get("value") or {}).get("value")
        txt = (n.get("name", {}).get("value") or "")
        if role and r != role:
            continue
        if name and txt != name:
            continue
        if name_re and not _re.search(name_re, txt):
            continue
        bid = n.get("backendDOMNodeId")
        if bid:
            out.append({"name": txt, "role": r, "bid": bid})
            if len(out) >= max_results:
                break
    return out


def ax_center(bid: int):
    model = cdp("DOM.getBoxModel", backendNodeId=bid)["model"]["content"]  # noqa: F821
    xs = model[0::2]
    ys = model[1::2]
    return sum(xs) / 4.0, sum(ys) / 4.0


def ax_click(*, name=None, role=None, name_re=None) -> bool:
    matches = ax_find(name=name, role=role, name_re=name_re)
    if not matches:
        return False
    x, y = ax_center(matches[0]["bid"])
    click_at_xy(int(x), int(y))  # noqa: F821
    wait(400)
    return True


def click_button_by_text(text: str) -> bool:
    """Click a button/link whose visible text contains ``text``. Tries AX first, then CSS."""
    if ax_click(name=text, role="button"):
        return True
    if ax_click(name_re=_re.escape(text), role="link"):
        return True
    if ax_click(name_re=_re.escape(text)):
        return True
    # CSS fallback: any clickable element whose text contains the label.
    found = js(  # noqa: F821 - pre-imported in browser-harness
        f"(function(){{var els=[...document.querySelectorAll('button,a,[role=button],input[type=submit]')];"
        f"for(var i=0;i<els.length;i++){{var t=(els[i].innerText||els[i].value||'').trim();"
        f"if(t.indexOf({_json.dumps(text)})>=0){{els[i].click();return true;}}}}return false;}})()"
    )
    if found:
        wait(400)
        return True
    return False


def fill_by_label(label_text: str, value: str, *, select_neighbor=False) -> bool:
    """Fill an input whose associated label text contains ``label_text``.

    Handles <label> wrapping the input, label[for], and aria-label fallbacks.
    """
    sel = js(  # noqa: F821 - pre-imported in browser-harness
        "(function(){"
        f"var lbl={_json.dumps(label_text)};"
        "var labels=[...document.querySelectorAll('label')];"
        "for(var i=0;i<labels.length;i++){"
        "var t=(labels[i].innerText||labels[i].textContent||'').trim();"
        "if(t.indexOf(lbl)<0)continue;"
        "var ctrl=labels[i].control||labels[i].querySelector('input,select,textarea');"
        "if(ctrl)return cssPath(ctrl);"
        "}"
        "var ins=[...document.querySelectorAll('input,select,textarea')];"
        "for(var j=0;j<ins.length;j++){"
        "var aria=ins[j].getAttribute('aria-label')||ins[j].getAttribute('placeholder')||'';"
        "if(aria.indexOf(lbl)>=0)return cssPath(ins[j]);"
        "}"
        "function cssPath(el){"
        "if(el.id)return '#'+el.id;"
        "var p=el,n=0,sel='';"
        "while(p&&p.nodeType===1){"
        "var name=p.tagName.toLowerCase();"
        "if(p.className&&typeof p.className==='string'){"
        "var c=p.className.trim().split(/\\s+/).slice(0,2).join('.');"
        "if(c)name+='.'+c;"
        "}"
        "var sib=p,f=1;"
        "while((sib=sib.previousElementSibling))if(sib.tagName===p.tagName)f++;"
        "sel=name+':nth-of-type('+f+')'+(sel?'>'+sel:'');"
        "p=p.parentElement;n++;if(n>8)break;"
        "}"
        "return sel;"
        "}"
        "return null;})()"
    )
    if not sel:
        return False
    try:
        fill_input(sel, value)  # noqa: F821
        return True
    except Exception:
        return False


def select_by_label(label_text: str, value_text: str) -> bool:
    """Choose a <select> option by visible label text near ``label_text``."""
    ok = js(  # noqa: F821 - pre-imported in browser-harness
        "(function(){"
        f"var lbl={_json.dumps(label_text)},val={_json.dumps(value_text)};"
        "var sels=[...document.querySelectorAll('select')];"
        "for(var i=0;i<sels.length;i++){"
        "var lblEl=sels[i].closest('label')||(sels[i].id?document.querySelector('label[for=\"'+sels[i].id+'\"]'):null);"
        "var t=lblEl?(lblEl.innerText||''):'';"
        "if(t.indexOf(lbl)<0&&sels[i].getAttribute('aria-label','').indexOf(lbl)<0)continue;"
        "for(var j=0;j<sels[i].options.length;j++){"
        "if((sels[i].options[j].text||'').indexOf(val)>=0){sels[i].selectedIndex=j;sels[i].dispatchEvent(new Event('change',{bubbles:true}));return true;}}"
        "}"
        "return false;})()"
    )
    return bool(ok)


def snapshot(label: str = "snapshot") -> str:
    """Return a compact visible-state string for evidence."""
    info = page_info()  # noqa: F821
    body = body_text()
    return f"[{label}] url={info['url']} title={info['title']!r} body[:200]={body[:200]!r}"