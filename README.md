# 低成本图集站 Starter

这是一个可以直接部署到 Cloudflare Pages 的纯静态网站模板。

## 文件说明

- `index.html`：首页
- `assets/style.css`：样式
- `assets/app.js`：图集数据、搜索、分类、弹窗
- `posts/`：单篇图集页面

## 怎么添加一个新图集？

1. 复制 `posts/sample-01.html`，改名为 `posts/你的图集名.html`
2. 修改里面的标题、分类、图片地址
3. 打开 `assets/app.js`
4. 在 `posts = [...]` 里面新增一条图集数据

## 图片放哪里？

测试阶段可以先用外链图片。
正式阶段建议放 Cloudflare R2，然后把图片 URL 替换到 `cover` 和文章页图片里。
