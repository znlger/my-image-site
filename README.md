# 女明星生图：可视化后台 + R2 上传版

这个版本包含：

- 前台首页 `index.html`
- 动态详情页 `gallery.html`
- 可视化后台 `admin.html`
- Cloudflare Pages Functions 接口
- R2 上传接口
- 网站设置保存
- 图集数据保存

## 你需要在 Cloudflare Pages 里设置 3 个东西

### 1. R2 绑定

进入 Cloudflare Pages 项目：

Settings → Functions → R2 bucket bindings

添加：

Variable name:

```
IMAGES
```

Bucket 选择：

```
female-star-images
```

### 2. 管理员密码

Settings → Environment variables

添加：

```
ADMIN_PASSWORD
```

值自己设置，比如：

```
my-strong-password-123
```

以后打开 `/admin.html` 就用这个密码登录。

### 3. R2 公共图片地址

Settings → Environment variables

添加：

```
IMAGE_BASE_URL
```

值填你的 R2 Public Development URL：

```
https://pub-028955ec84bf459da0de8cda01630dea.r2.dev
```

## 上传 GitHub

把这些文件上传到 GitHub 仓库根目录：

```
index.html
gallery.html
admin.html
assets
functions
data
README.md
```

上传后 Cloudflare Pages 会自动部署。

## 使用方法

打开：

```
https://你的网站/admin.html
```

输入管理员密码。

可以直接：

- 修改网站名称
- 修改首页标题
- 新增图集
- 编辑图集标题
- 上传封面图
- 上传多张详情图
- 删除详情图
- 保存后前台自动更新

## 注意

这个版本会把图集数据保存到 R2：

```
data/galleries.json
data/site.json
```

图片会保存到 R2：

```
covers/
galleries/
```

如果后台提示 Unauthorized，就是 ADMIN_PASSWORD 没设置好，或输入密码不一致。

如果图片上传成功但前台看不到，检查 IMAGE_BASE_URL 是否填对，以及 R2 Public Development URL 是否开启。
