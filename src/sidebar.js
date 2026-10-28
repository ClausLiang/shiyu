// 侧栏折叠：PC 端收起左侧导航，让学习区占满窗口；手机端导航在顶部横排，不参与折叠。
// 普通脚本在首屏绘制前恢复偏好，避免刷新时侧栏先展开再收起；状态只影响布局，不计入学习进度。
(() => {
  const SIDEBAR_KEY = 'shiyu:sidebar:v1';
  const root = document.documentElement;
  let storage = null;
  let collapsed = false;
  try {
    storage = window.localStorage;
    collapsed = storage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch { /* 无法读取偏好时按展开处理，仍允许在当前页面折叠。 */ }

  function apply(value) {
    collapsed = Boolean(value);
    if (collapsed) root.dataset.sidebar = 'collapsed';
    else delete root.dataset.sidebar;

    const button = document.querySelector('#sidebar-toggle');
    if (button) {
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏');
      button.title = collapsed ? '展开侧边栏' : '收起侧边栏';
    }
    // 收起后的侧栏在视口外，禁止它继续接收焦点和点击。
    const sidebar = document.querySelector('#sidebar');
    if (sidebar) sidebar.inert = collapsed;
  }

  apply(collapsed);
  document.addEventListener('DOMContentLoaded', () => {
    apply(collapsed);
    // 同步完初始状态后再开启过渡，刷新时不会看到侧栏滑出。
    requestAnimationFrame(() => { root.dataset.sidebarAnim = 'on'; });
  }, { once: true });

  document.addEventListener('click', event => {
    const button = event.target.closest('#sidebar-toggle');
    if (!button) return;
    const sidebar = document.querySelector('#sidebar');
    // 焦点还在侧栏里时先移回按钮，避免焦点落在已隐藏的区域。
    if (!collapsed && sidebar?.contains(document.activeElement)) button.focus();
    apply(!collapsed);
    try {
      storage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
    } catch { /* 偏好保存失败只影响下次打开，本次折叠仍然有效。 */ }
  });

  window.addEventListener('storage', event => {
    if (event.storageArea !== storage || (event.key !== SIDEBAR_KEY && event.key !== null)) return;
    apply(event.newValue === 'collapsed');
  });
})();
