import os
from pathlib import Path

from playwright.sync_api import sync_playwright


URL = os.environ.get("PACKAGING_ANNOTATION_TEST_URL", "http://127.0.0.1:43123/")
REPO_ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = Path(os.environ.get(
    "PACKAGING_ANNOTATION_SCREENSHOT",
    REPO_ROOT / "artifacts" / "packaging_teaching_session" / "annotation_tool_logs" / "annotation_ui_compact_verified.png",
))
OVERVIEW_SCREENSHOT = SCREENSHOT.with_name("annotation_ui_compact_overview.png")
EXPANDED_SCREENSHOT = SCREENSHOT.with_name("annotation_ui_group_expanded.png")
REDESIGNED_SCREENSHOT = SCREENSHOT.with_name("annotation_ui_redesigned.png")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    )
    page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("document.querySelector('#imageCanvas').width > 1000")

    case_states = []
    tabs = page.locator("#tabs button")
    if tabs.count() != 3:
        raise AssertionError(f"Expected three teaching cases, found {tabs.count()}")
    for index in range(tabs.count()):
        if index:
            tabs.nth(index).click()
            page.wait_for_timeout(300)
        state = page.evaluate(
            """
            () => {
              const canvas = document.querySelector('#imageCanvas');
              const ctx = canvas.getContext('2d');
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let nonWhite = 0;
              for (let i = 0; i < data.length; i += 400) {
                if (data[i + 3] > 0 && (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248)) nonWhite++;
              }
              const wrap = document.querySelector('.work').getBoundingClientRect();
              const stage = document.querySelector('#stage').getBoundingClientRect();
              const reference = document.querySelector('#referenceCanvas');
              const referenceData = reference.getContext('2d').getImageData(0, 0, reference.width, reference.height).data;
              let overlayPixels = 0;
              for (let i = 3; i < referenceData.length; i += 40) if (referenceData[i] > 0) overlayPixels++;
              const debug = window.__packagingAnnotationDebug;
              const groups = debug.items.filter(item => item.kind === 'group');
              let overlaps = 0;
              for (let a = 0; a < groups.length; a++) {
                for (let b = a + 1; b < groups.length; b++) {
                  const x = groups[a].rect;
                  const y = groups[b].rect;
                  if (!(x.x + x.w + 3 < y.x || y.x + y.w + 3 < x.x || x.y + x.h + 3 < y.y || y.y + y.h + 3 < x.y)) overlaps++;
                }
              }
              const outOfBounds = groups.filter(item => item.rect.x < 0 || item.rect.y < 0 || item.rect.x + item.rect.w > canvas.width || item.rect.y + item.rect.h > canvas.height).length;
              return {
                width: canvas.width,
                height: canvas.height,
                nonWhite,
                overlayPixels,
                wrapWidth: wrap.width,
                stageWidth: stage.width,
                mode: debug.overlayMode,
                visibleObjects: debug.visibleObjects,
                groupCount: groups.length,
                overlaps,
                outOfBounds,
              };
            }
            """
        )
        if state["nonWhite"] < 100:
            raise AssertionError(f"Case {index + 1} image appears blank: {state}")
        if state["overlayPixels"] < 20:
            raise AssertionError(f"Case {index + 1} reference overlay appears blank: {state}")
        if state["stageWidth"] > state["wrapWidth"] + 2:
            raise AssertionError(f"Case {index + 1} drawing is not fitted: {state}")
        if state["stageWidth"] < state["wrapWidth"] * 0.8:
            raise AssertionError(f"Case {index + 1} drawing is fitted too small: {state}")
        if state["mode"] != "compact":
            raise AssertionError(f"Case {index + 1} did not default to compact annotations: {state}")
        expected_group_count = 9 if index == 1 else 7
        if state["groupCount"] != expected_group_count:
            raise AssertionError(f"Case {index + 1} compact group count is wrong: {state}")
        if state["overlaps"] or state["outOfBounds"]:
            raise AssertionError(f"Case {index + 1} compact labels are not cleanly laid out: {state}")
        case_states.append(state)

    mask = page.locator("#maskCanvas")
    box = mask.bounding_box()
    if box is None:
        raise AssertionError("Mask canvas has no layout box")
    page.mouse.move(box["x"] + box["width"] * 0.4, box["y"] + box["height"] * 0.4)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.45, steps=5)
    page.mouse.up()
    mask_alpha_after_draw = page.evaluate(
        """() => {
          const c = document.querySelector('#maskCanvas');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
          return false;
        }"""
    )
    if not mask_alpha_after_draw:
        raise AssertionError("Brush interaction did not create mask pixels")

    page.locator("#clear").click()
    mask_alpha_after_clear = page.evaluate(
        """() => {
          const c = document.querySelector('#maskCanvas');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
          return false;
        }"""
    )
    if mask_alpha_after_clear:
        raise AssertionError("Clear did not remove mask pixels")

    tabs.nth(0).click()
    page.wait_for_function("document.querySelector('#objectDetail').textContent.includes('对象')")
    page.locator("aside").evaluate("element => { element.scrollTop = 0; }")
    OVERVIEW_SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OVERVIEW_SCREENSHOT), full_page=True)
    page.screenshot(path=str(REDESIGNED_SCREENSHOT), full_page=True)
    page.locator('[data-tool="object"]').click()
    flap_group_rect = page.evaluate(
        """() => {
          const group = window.__packagingAnnotationDebug.items.find(item => item.kind === 'group' && item.memberObjectIds.includes('D08'));
          return group.rect;
        }"""
    )
    box = mask.bounding_box()
    if box is None:
        raise AssertionError("Mask canvas lost its layout box")
    click_x = box["x"] + box["width"] * (flap_group_rect["x"] + flap_group_rect["w"] / 2) / 1672
    click_y = box["y"] + box["height"] * (flap_group_rect["y"] + flap_group_rect["h"] / 2) / 941
    page.mouse.click(click_x, click_y)
    page.wait_for_selector('#objectDetail [data-object-id="D08"]')
    selected_after_group_open = page.evaluate("() => window.__packagingAnnotationDebug.selectedObjectIds")
    if selected_after_group_open:
        raise AssertionError(f"Opening an equivalence group bound objects unexpectedly: {selected_after_group_open}")
    page.locator('#objectDetail [data-object-id="D08"]').click()
    selected_after_member_click = page.evaluate("() => window.__packagingAnnotationDebug.selectedObjectIds")
    if selected_after_member_click != ["D08"]:
        raise AssertionError(f"Exact member targeting did not bind only D08: {selected_after_member_click}")
    page.locator("aside").evaluate("element => { element.scrollTop = 0; }")
    page.screenshot(path=str(EXPANDED_SCREENSHOT), full_page=True)

    page.locator('[data-density="full"]').click()
    full_mode_state = page.evaluate("() => ({mode: window.__packagingAnnotationDebug.overlayMode, count: window.__packagingAnnotationDebug.items.length})")
    if full_mode_state != {"mode": "full", "count": 16}:
        raise AssertionError(f"Full annotation mode did not expose all dimensions: {full_mode_state}")
    page.locator('[data-density="compact"]').click()

    page.locator("#note").fill("把 D08 改成 170 mm，其他位置不要动")
    page.locator("#save").click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('精确目标：D08')")

    page.locator("aside").evaluate("element => { element.scrollTop = 0; }")
    page.screenshot(path=str(SCREENSHOT), full_page=True)
    if console_errors:
        raise AssertionError(f"Browser console errors: {console_errors}")

    viewport_states = []
    for width, height in ((1600, 1000), (1440, 900), (1366, 768)):
        viewport_page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        viewport_console_errors: list[str] = []
        viewport_page.on(
            "console",
            lambda message, errors=viewport_console_errors: errors.append(message.text)
            if message.type == "error"
            else None,
        )
        viewport_page.goto(URL, wait_until="networkidle")
        viewport_page.wait_for_function("document.querySelector('#imageCanvas').width > 1000")
        viewport_page.wait_for_function(
            "window.__packagingAnnotationDebug && window.__packagingAnnotationDebug.items.length > 0"
        )
        viewport_page.wait_for_timeout(700)
        layout = viewport_page.evaluate(
            """
            () => {
              const rect = selector => document.querySelector(selector).getBoundingClientRect();
              const work = rect('.work');
              const aside = rect('aside');
              const toolbar = rect('.canvasToolbar');
              const wrap = rect('.canvasWrap');
              const stage = rect('#stage');
              const save = rect('#save');
              const footer = rect('.inspectorFooter');
              return {
                viewport: [innerWidth, innerHeight],
                bodyScroll: [document.body.scrollWidth, document.body.scrollHeight],
                workRight: work.right,
                asideLeft: aside.left,
                asideRight: aside.right,
                toolbarScrollWidth: document.querySelector('.canvasToolbar').scrollWidth,
                toolbarWidth: toolbar.width,
                toolbarBottom: toolbar.bottom,
                wrapTop: wrap.top,
                wrapSize: [wrap.width, wrap.height],
                stageSize: [stage.width, stage.height],
                saveTop: save.top,
                saveBottom: save.bottom,
                footerTop: footer.top,
                footerBottom: footer.bottom,
              };
            }
            """
        )
        if layout["bodyScroll"][0] > width + 1 or layout["bodyScroll"][1] > height + 1:
            raise AssertionError(f"Viewport {width}x{height} has page overflow: {layout}")
        if layout["workRight"] > layout["asideLeft"] + 1 or layout["asideRight"] > width + 1:
            raise AssertionError(f"Viewport {width}x{height} work and inspector overlap: {layout}")
        if layout["toolbarScrollWidth"] > layout["toolbarWidth"] + 1:
            raise AssertionError(f"Viewport {width}x{height} toolbar overflows: {layout}")
        if layout["toolbarBottom"] > layout["wrapTop"] + 31:
            raise AssertionError(f"Viewport {width}x{height} toolbar overlaps the canvas: {layout}")
        if layout["stageSize"][0] > layout["wrapSize"][0] + 2 or layout["stageSize"][1] > layout["wrapSize"][1] + 2:
            raise AssertionError(f"Viewport {width}x{height} stage is not fitted: {layout}")
        if layout["saveTop"] < layout["footerTop"] - 1 or layout["saveBottom"] > min(height, layout["footerBottom"]) + 1:
            raise AssertionError(f"Viewport {width}x{height} save action is not reachable: {layout}")
        if viewport_console_errors:
            raise AssertionError(f"Viewport {width}x{height} console errors: {viewport_console_errors}")
        viewport_states.append(layout)
        viewport_page.close()

    print({
        "cases": case_states,
        "draw": mask_alpha_after_draw,
        "clear": not mask_alpha_after_clear,
        "target": "D08",
        "viewports": viewport_states,
        "overviewScreenshot": str(OVERVIEW_SCREENSHOT),
        "expandedScreenshot": str(EXPANDED_SCREENSHOT),
        "screenshot": str(SCREENSHOT),
        "redesignedScreenshot": str(REDESIGNED_SCREENSHOT),
    })
    browser.close()
