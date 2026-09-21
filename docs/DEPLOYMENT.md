# 部署到 GitHub Pages

## 目录名称与访问路径

本地目录 `english-learning` 可以保留。GitHub Pages 项目站点的默认路径由 GitHub 仓库名决定，与本地目录名、package.json 中的包名无关。

目标 GitHub 仓库为 `ClausLiang/shiyu` 时，默认访问地址为：

https://clausliang.github.io/shiyu/

已于 2026-09-21 正式部署成功。当前默认地址返回 HTTP 301，跳转到 https://liangyonggang.com/shiyu/ ，已在浏览器验证页面加载、拼写检查及刷新恢复进度。

发布记录：[Deploy GitHub Pages #2](https://github.com/ClausLiang/shiyu/actions/runs/35572368130)，发布提交为 `941127520130ab5357ee2423121b98df00b570a9`。

## 首次发布

1. 仓库已从 `ClausLiang/english-learning` 重命名为 `ClausLiang/shiyu`；本地目录保持 `english-learning`。
2. 本地远程地址已更新；其他旧检出可执行：

   ```sh
   git remote set-url origin git@github.com:ClausLiang/shiyu.git
   ```

3. 在目标仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 将项目源文件和 `.github/workflows/deploy-pages.yml` 提交并推送到 `main`。`dist/` 是构建产物，不需要提交。
5. 在 **Actions → Deploy GitHub Pages** 查看执行状态。工作流测试通过后构建 `dist/`，上传并部署到 Pages。
6. 部署成功后打开工作流给出的站点链接，检查卡片、词库加载和刷新恢复。

仓库需要具备当前 GitHub 账号方案所支持的 Pages 发布条件；最终以 Settings → Pages 中显示的选项为准。

## 路径与本地进度

- 入口中的脚本、样式和图标使用相对路径；词库请求以模块 URL 为基准，因此无需把 `/shiyu/` 写死到源码中。
- 之后推送到 `main` 会自动更新网站，也可以使用工作流的 **Run workflow** 手动发布。
- 线上进度与本地地址的记录独立；可从本地导出备份，在 Pages 网站导入。
- localStorage 按协议、主机和端口隔离，不按 URL 路径隔离；当前进度保存在最终访问域名 `liangyonggang.com` 下，同域名的其他项目需要使用各自的存储键。以后切换域名时，可导出再导入备份。
- GitHub Pages 仅托管静态文件，账号和远端同步需后续另接服务。
