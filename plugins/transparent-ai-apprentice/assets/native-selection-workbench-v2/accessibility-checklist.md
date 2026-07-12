# 无障碍检查清单

- [x] 页面语言为 `zh-CN`，标题说明当前独立工作台。
- [x] 图标按钮有中文 `aria-label`；工具选择同步 `aria-pressed`。
- [x] `focus-visible` 使用 2px 工程蓝焦点环，键盘焦点不被阴影吞没。
- [x] 表单字段有可见标签；状态区使用 `role=status`。
- [x] 修改/保护/参考关系除颜色外还使用边框、图例文字与对象/区域标签。
- [x] 桌面信标是原生 button，可用 Enter/Space 唤起，不依赖 hover。
- [x] 桌面右键入口在移动端由信标/长按等价打开操作面。
- [x] 关键按钮高度不低于 34px；移动操作面主按钮不低于 46px，Canvas 使用 `touch-action:none`。
- [x] 1366×768 下检查器独立滚动，提交区固定可达；移动端底部操作面可关闭。
- [x] 中文文案不依赖固定英文宽度；定位器/ID 允许等宽换行。
- [x] `prefers-reduced-motion` 将所有动画缩短到近零。
- [x] loading/success/error/offline/waiting 均有文字与状态点。
- [x] `assistant-v2.js` 创建共享 `aria-live=polite` 状态播报器，选择读取、预览、送审、错误和宿主结果状态均可播报。
- [x] Word 原生选区、工程对象树和当前对象操作面均有可访问名称；装饰 Canvas 使用 `aria-hidden=true`，交互 Canvas 使用明确中文 `aria-label`。
