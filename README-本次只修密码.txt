本包基于已确认的基准版本 my-image-site-corrected-admin-restored-features.zip 重新生成。

本次只修改：
- assets/admin-live.js 里的后台登录校验逻辑

不修改：
- index.html
- gallery.html
- assets/app.js
- assets/style.css
- 后台正式 UI
- 后台自检
- 网站设置
- 图集列表拖动排序
- 详情图拖动排序
- 详情图任选一张设为封面
- 水印二级页面样式和功能
- 前端搜索按钮
- 图标明暗主题按钮
- 独立关于页
- 不包含 data/galleries.json，不会覆盖 R2 旧图集数据

重要：
如果你在 GitHub 测试分支部署后“正确密码也进不去”，通常是 Cloudflare Pages 的 Preview 环境没有配置：
- ADMIN_PASSWORD
- R2 binding: IMAGES
- IMAGE_BASE_URL
需要在 Cloudflare Pages 的 Preview 环境也配置这些变量和绑定，或者在 Production 环境测试。
