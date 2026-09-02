# tableread

瀏覽器 Agent 協作的 SillyTavern 角色卡試玩平台 — 透過 [WebMCP](https://github.com/webmachinelearning/webmcp)（`document.modelContext.registerTool()`）把角色卡撰寫、世界書/正則腳本驗證、多輪試玩模擬、跨情境比較都變成可以直接被瀏覽器內 Agent（Chrome 149+ 內建、或 ChatGPT in-app browser）呼叫的工具，讓創作者跟 Agent 一起把一張 SillyTavern 角色卡從草稿寫到能上線的品質。

**English speakers**: see [`docs/submission.md`](./docs/submission.md) for a full English write-up (the pain, why WebMCP, what's newly possible, implementation) — this README's body is otherwise in Traditional Chinese, the project's primary language.

- **Live demo**: https://alanis6v6.github.io/tableread/
- **Demo 影片**: TODO（#10 完成後回填）

## Quick start

```bash
npm install
npm run dev
```

打開 `http://localhost:8787/`。

## WebMCP 需求

- **Chrome 149+**，並開啟 `chrome://flags/#enable-webmcp-testing`
- 或使用 **ChatGPT in-app browser**
- `document.modelContext` 需要 secure context：`http://localhost` 本身就算，但**正式部署後需要 HTTPS**（見 [#6](https://github.com/alanis6v6/tableread/issues/6)）

沒有支援 WebMCP 的環境仍可開啟頁面看 UI，但 Agent 呼叫的十個工具不會被註冊。

## 十個 WebMCP 工具

| 工具 | 說明 |
| --- | --- |
| `get_checklist_status` | 讀取角色卡草稿在七個豐富度面向＋MVU 決策上的完成狀態（純讀取） |
| `update_card_field` | 把一段內容或一個判斷結果寫進草稿狀態 |
| `assemble_card` | 把目前草稿組裝成完整、符合 `chara_card_v3` 規格的角色卡 JSON |
| `list_scenarios` | 列出目前可以拿來試玩的情境（`first_mes`／`alternate_greetings`／自訂情境） |
| `add_scenario` | 新增一個自訂試玩情境 |
| `run_scenario` | 針對某個情境開始一次全新的試玩模擬（建立新 session） |
| `get_playtest_context` | 在寫某一輪的玩家台詞與角色演出之前，取得這一輪真正會被注入的世界書內容與目前變量狀態 |
| `commit_playtest_round` | 提交某一輪的玩家台詞／角色演出，套用 regex 腳本與變量變更 |
| `get_transcript` | 取得某個情境累積到目前為止的逐輪紀錄 |
| `compare_scenarios` | 唯讀：把一批已經跑過的情境攤開成跨情境比較，含世界書觸發差異 |

完整的呼叫順序與參數說明在各工具的 `description` / `inputSchema` 裡（見 `src/tools/registerTools.js`），Agent 可直接讀取。

## 測試

```bash
npm test
```

跑 `node --test`：74 個 unit test（涵蓋 `src/engine` 的角色卡/世界書/正則腳本/session 邏輯與 `src/tools` 的工具邏輯）＋一組 golden parity 測試（`test/golden/`，用固定的多輪對話輸入比對預期輸出，確保這份 JS 邏輯跟原始 Python 引擎行為一致）。

## 專案來源

核心試玩邏輯（世界書關鍵詞掃描、常駐/冷卻/延遲規則、正則腳本套用、變量狀態機）是從 [`alanis6v6/st_writer`](https://github.com/alanis6v6/st_writer) 的 `playtest_engine.py` 移植到 JavaScript，並以 golden test 驗證跟原始 Python 版本的行為一致（見 `test/golden/`）。

## 授權

[MIT](./LICENSE)
