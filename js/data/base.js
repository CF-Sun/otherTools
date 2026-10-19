/* 資料層的共用命名空間與建構輔助函式。其他 data 檔案都往 window.IPAS 註冊內容。
 *
 * 重要：題目與名詞卡的 id 由「項目代碼 + 該項目內的出現順序」產生，
 * 使用者的作答進度以 id 儲存，因此新增內容請一律「附加在檔案尾端」，不要插入或重排既有題目。 */
(function () {
  const IPAS = (window.IPAS = window.IPAS || {});

  IPAS.outlineVersion = '115.06';
  IPAS.defaultExamDate = '2026-11-14'; // 115 年第二次中級鑑定（以官網公告為準）
  IPAS.notes = {};      // itemId -> markdown
  IPAS.questions = [];  // 題庫
  IPAS.cards = [];      // 名詞卡
  IPAS.cheats = [];     // 速查表

  const qCount = {};
  const cCount = {};
  const pad = (n) => String(n).padStart(2, '0');

  /** Q(item, level, stem, options, answerIndex, explanation, extra)
   *  level: 1 基礎 / 2 進階 / 3 應用(情境、計算、程式)
   *  extra: { code: 'Python 程式碼', fixed: true（不洗牌選項）} */
  IPAS.Q = function (item, level, stem, options, answer, explain, extra) {
    qCount[item] = (qCount[item] || 0) + 1;
    IPAS.questions.push(
      Object.assign(
        { id: item + '-' + pad(qCount[item]), item, subject: item.slice(0, 3), level, stem, options, answer, explain },
        extra || {}
      )
    );
  };

  /** C(item, front, back) 名詞卡 */
  IPAS.C = function (item, front, back) {
    cCount[item] = (cCount[item] || 0) + 1;
    IPAS.cards.push({ id: item + '-c' + pad(cCount[item]), item, subject: item.slice(0, 3), front, back });
  };

  /** 速查表 */
  IPAS.S = function (id, subjects, title, md) {
    IPAS.cheats.push({ id, subjects, title, md });
  };
})();
