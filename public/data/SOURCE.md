# CET-4 词库来源

- 数据提供页面：https://qwertylearner.cn/
- 实际数据 URL：https://qwertylearner.cn/dicts/CET4_T.json
- 上游项目：https://github.com/Kaiyiwing/qwerty-learner
- 获取日期：2026-09-21（Asia/Shanghai）
- 原始数据 SHA-256：733dd9f9c05ed9e3c35fbd65608e4e061e2d34c461723e057513e346562992de
- 词条数：2607；按 `name` 校验，无重复。
- 字段：`name`、`trans`、`usphone`、`ukphone`。
- 本项目保持原始 JSON 内容和词序，不添加虚构释义或音标；按顺序每 20 个一章。
- 本地词库标识：`cet4-qwerty-2607-v1`。词库更新涉及章节变化时应显式版本迁移，不能直接替换已发布词序。

页面的前端资源明确将 CET-4 配置为 `/dicts/CET4_T.json`、2607 词。本地数据直接取自该公开 JSON；未复制上游应用代码。

上游仓库的 LICENSE 为 GNU GPL v3，完整文本随数据保存在 `LICENSE-QWERTY.txt`。许可证获取地址：https://cdn.jsdelivr.net/gh/Kaiyiwing/qwerty-learner@master/LICENSE 。本记录不把公共下载地址解释为无条件再分发授权；公开发布前需核对词典数据是否另有来源与授权要求，并履行适用的许可义务。


## 2026-09-21 补充：上游数据来源核查

- 原项目地址现重定向至 https://github.com/RealKai42/qwerty-learner ，README 的「数据来源」明确链接 https://github.com/kajweb/dict ，并说明该项目爬取了常见字典。
- kajweb/dict 的 README 开头注明数据来自背单词 App 的抓取；目录将 CET4_3 标为「新东方四级词汇」，共 2607 词，并给出网易域名上的原始下载地址。
- 该 README 的 CET4_3 示例首词为 cancel，音标和中文释义与本地词库首词相符。词条数和示例支持来源关联，但本次未逐条比对完整原始数据包。
- 在本次查看的 kajweb/dict 根目录及 README 中，未找到足以确认这些第三方词典内容可公开再分发或商用的明确授权。其「侵权联系后下架」声明不等于权利人授权。
- Qwerty Learner 仓库标示 GPL-3.0，不能单凭该标示推断上游第三方词典内容的权利已得到完整授权。署名和保留许可证也不替代缺失的内容授权。
- 当前结论：公开发布或商业使用的授权尚未确认；建议发布前取得相应权利人授权，或改用许可明确的数据。个人本地学习与公开传播是不同使用场景，本记录不作确定的合法性判断。
- 本次仅补充来源核查，不删除或更换现有词库。
