# 部署到 GitHub Pages

## 目录名称与访问路径

本地目录 `english-learning` 可以保留。GitHub Pages 项目站点的默认路径由 GitHub 仓库名决定，与本地目录名、package.json 中的包名无关。

目标 GitHub 仓库为 `ClausLiang/shiyu` 时，默认访问地址为：

https://clausliang.github.io/shiyu/

这是预期地址，只有部署成功后才能访问。若仓库仍叫 `english-learning`，默认地址则是 `/english-learning/`；在该仓库产物中再套一层 `shiyu` 文件夹会得到 `/english-learning/shiyu/`，不能实现所需路径。

## 首次发布

1. 已选择重命名现有仓库：在 GitHub 打开 `ClausLiang/english-learning`，进入 **Settings → General → Repository name**，将名称改为 `shiyu` 并点击 **Rename**。
2. 若采用重命名，在本地更新远程地址：

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
- localStorage 按协议、主机和端口隔离，不按 URL 路径隔离；同一 `clausliang.github.io` 下的其他项目需要使用各自的存储键。
- GitHub Pages 仅托管静态文件，账号和远端同步需后续另接服务。
