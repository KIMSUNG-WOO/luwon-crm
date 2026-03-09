/* =========================================================
   LUWON CRM - schedule.js
   일정등록 / 네이트온 미리보기 / 갑섭외 풀복사 / 익일취합
   ========================================================= */

(function () {
  "use strict";

  function safeGet(id) {
    return document.getElementById(id);
  }

  function normalizeText(v) {
    return String(v || "").trim();
  }

  function normalizePhone(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function formatPhone(v) {
    const d = normalizePhone(v);
    if (!d) return "";

    if (d.length === 11) {
      return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    }
    if (d.length === 10 && d.startsWith("02")) {
      return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    }
    if (d.length === 10) {
      return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    }
    if (d.length === 9 && d.startsWith("02")) {
      return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    }
    return String(v || "").trim();
  }

  function normalizeManualTime(v) {
    const raw = String(v || "").trim();
    if (!raw) return "";

    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const [hh, mm] = raw.split(":");
      const h = Math.max(0, Math.min(23, Number(hh)));
      const m = Math.max(0, Math.min(59, Number(mm)));
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";

    if (digits.length === 3) {
      const h = Number(digits.slice(0, 1));
      const m = Number(digits.slice(1));
      if (h <= 23 && m <= 59) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    }

    if (digits.length === 4) {
      const h = Number(digits.slice(0, 2));
      const m = Number(digits.slice(2));
      if (h <= 23 && m <= 59) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    }

    if (digits.length <= 2) {
      const h = Math.max(0, Math.min(23, Number(digits)));
      return `${String(h).padStart(2, "0")}:00`;
    }

    return raw;
  }

  function safeCopy(text) {
    if (!text) {
      alert("복사할 내용이 없어.");
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => alert("복사 완료"))
        .catch(() => fallbackCopy(text));
      return;
    }

    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      alert("복사 완료");
    } catch (e) {
      alert("복사 실패");
    }
    document.body.removeChild(ta);
  }

  function getTodayStr() {
    if (typeof todayStr === "function") return todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function getTomorrowStr() {
    if (typeof tomorrowStr === "function") return tomorrowStr();
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function shortDateMMDD(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || "";
    return `${dateStr.slice(5, 7)}-${dateStr.slice(8, 10)}`;
  }

  function simplifyAddress(address) {
    const src = normalizeText(address);
    if (!src) return "";

    const parts = src.split(/\s+/).filter(Boolean);
    const picked = [];

    const endPattern = /(시|도|구|군|읍|면|동|리|가|로|길|내)$/;

    for (let i = 0; i < parts.length; i++) {
      picked.push(parts[i]);
      if (endPattern.test(parts[i])) {
        if (picked.length >= 3) break;
      }
    }

    if (picked.length === 0) {
      return parts.slice(0, 3).join(" ");
    }

    return picked.join(" ");
  }

  function isTomorrow(dateStr) {
    return dateStr === getTomorrowStr();
  }

  function getVisibleSchedules() {
    if (typeof isAdminMode === "function" && isAdminMode()) {
      return schedules.slice();
    }
    if (typeof currentStaffNo === "function") {
      return schedules.filter(row => row.createdByNo === currentStaffNo());
    }
    return schedules.slice();
  }

  function buildFullCopyText(row) {
    return [
      `섭외자 : ${row.assignee || ""}`,
      `날짜 : ${row.date || ""}`,
      `시간 : ${row.time || ""}`,
      `업체 : ${row.company || ""}`,
      `주소 : ${row.address || ""}`,
      `키맨 : ${row.manager || ""}`,
      `번호 : ${formatPhone(row.phone || "")}`,
      `인원 : ${row.people || ""}`,
      `갑사: ${row.gap || ""}`,
      `은행 : ${row.bank || ""}`,
      `특이사항 : ${row.memo || ""}`
    ].join("\n");
  }

  function buildNateonPreviewText(payload) {
    const company = normalizeText(payload.company);
    const people = normalizeText(payload.people);
    const date = shortDateMMDD(payload.date);
    const time = normalizeManualTime(payload.time);
    const shortAddr = simplifyAddress(payload.address);
    const assignee = normalizeText(payload.assignee);
    const assigneeFinal = assignee ? `${assignee}${isTomorrow(payload.date) ? "(익일)" : ""}` : "";

    return [
      company,
      people,
      date,
      time,
      shortAddr,
      assigneeFinal
    ].filter(Boolean).join("/");
  }

  function readFormPayload() {
    const payload = {
      assignee: normalizeText(safeGet("scheduleAssignee")?.value || (typeof currentStaffName === "function" ? currentStaffName() : "")),
      date: normalizeText(safeGet("scheduleDate")?.value),
      time: normalizeManualTime(safeGet("scheduleTime")?.value),
      company: normalizeText(safeGet("scheduleCompany")?.value),
      manager: normalizeText(safeGet("scheduleManager")?.value),
      phone: normalizePhone(safeGet("schedulePhone")?.value),
      address: normalizeText(safeGet("scheduleAddress")?.value),
      people: normalizeText(safeGet("schedulePeople")?.value),
      gap: normalizeText(safeGet("scheduleGap")?.value),
      bank: normalizeText(safeGet("scheduleBank")?.value),
      memo: normalizeText(safeGet("scheduleMemo")?.value),
      status: "등록완료",
      createdBy: typeof currentStaffName === "function" ? currentStaffName() : "",
      createdByNo: typeof currentStaffNo === "function" ? currentStaffNo() : "",
      createdAt: getTodayStr(),
      createdAtTs: Date.now()
    };
    return payload;
  }

  function validatePayload(payload) {
    if (!payload.assignee) return "섭외자는 꼭 입력해줘.";
    if (!payload.date) return "날짜는 꼭 입력해줘.";
    if (!payload.time) return "시간은 꼭 입력해줘.";
    if (!payload.company) return "업체는 꼭 입력해줘.";
    return "";
  }

  function isDuplicate(payload) {
    return schedules.some(row => {
      return String(row.date || "") === String(payload.date || "")
        && String(row.time || "") === String(payload.time || "")
        && String(row.company || "") === String(payload.company || "")
        && String(row.assignee || "") === String(payload.assignee || "");
    });
  }

  function clearScheduleForm() {
    [
      "scheduleAssignee",
      "scheduleDate",
      "scheduleTime",
      "scheduleCompany",
      "scheduleManager",
      "schedulePhone",
      "scheduleAddress",
      "schedulePeople",
      "scheduleGap",
      "scheduleBank",
      "scheduleMemo"
    ].forEach(id => {
      const el = safeGet(id);
      if (el) el.value = "";
    });

    const dateEl = safeGet("scheduleDate");
    if (dateEl) dateEl.value = getTomorrowStr();

    updateNateonPreview();
  }

  function updateNateonPreview() {
    const preview = safeGet("scheduleNateonPreview");
    if (!preview) return;

    const payload = readFormPayload();
    preview.value = buildNateonPreviewText(payload);
  }

  function onTimeBlurAutoFormat() {
    const timeEl = safeGet("scheduleTime");
    if (!timeEl) return;
    timeEl.value = normalizeManualTime(timeEl.value);
    updateNateonPreview();
  }

  function renderSchedules() {
    const body = safeGet("scheduleTableBody");
    if (!body) return;

    const rows = getVisibleSchedules().sort((a, b) => {
      const ak = `${a.date || ""} ${a.time || ""}`;
      const bk = `${b.date || ""} ${b.time || ""}`;
      return ak.localeCompare(bk, "ko");
    });

    body.innerHTML = "";

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="10"><div class="empty">등록된 일정이 없어.</div></td></tr>`;
      return;
    }

    rows.forEach(row => {
      body.innerHTML += `
        <tr>
          <td>${escapeHtml(row.assignee || "")}</td>
          <td>${escapeHtml(row.date || "")}</td>
          <td>${escapeHtml(row.time || "")}</td>
          <td>${escapeHtml(row.company || "")}</td>
          <td>${escapeHtml(row.manager || "")}</td>
          <td>${escapeHtml(formatPhone(row.phone || ""))}</td>
          <td>${escapeHtml(row.people || "")}</td>
          <td>${escapeHtml(row.gap || "")}</td>
          <td>${escapeHtml(row.memo || "")}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="ghost-btn" type="button" onclick="copyScheduleFullText(${row.createdAtTs})">복사</button>
              <button class="danger-btn" type="button" onclick="deleteScheduleByTs(${row.createdAtTs})">삭제</button>
            </div>
          </td>
        </tr>
      `;
    });
  }

  function addSchedule() {
    if (!window.state || !state.currentUser) return;

    const payload = readFormPayload();
    const err = validatePayload(payload);
    if (err) {
      alert(err);
      return;
    }

    if (isDuplicate(payload)) {
      const ok = confirm("같은 날짜/시간/업체/섭외자 일정이 이미 있어. 그래도 등록할까?");
      if (!ok) return;
    }

    schedules.unshift(payload);

    renderSchedules();
    loadAggregate();
    if (typeof runHomeSummary === "function") runHomeSummary();

    safeCopy(buildFullCopyText(payload));
    clearScheduleForm();
  }

  function copyScheduleFullText(createdAtTs) {
    const row = schedules.find(x => Number(x.createdAtTs) === Number(createdAtTs));
    if (!row) {
      alert("일정을 찾을 수 없어.");
      return;
    }
    safeCopy(buildFullCopyText(row));
  }

  function copyNateonPreview() {
    const preview = safeGet("scheduleNateonPreview");
    if (!preview || !preview.value.trim()) {
      alert("복사할 네이트온 양식이 없어.");
      return;
    }
    safeCopy(preview.value.trim());
  }

  function deleteScheduleByTs(createdAtTs) {
    const idx = schedules.findIndex(x => Number(x.createdAtTs) === Number(createdAtTs));
    if (idx < 0) {
      alert("일정을 찾을 수 없어.");
      return;
    }

    const ok = confirm("이 일정을 삭제할까?");
    if (!ok) return;

    schedules.splice(idx, 1);
    renderSchedules();
    loadAggregate();
    if (typeof runHomeSummary === "function") runHomeSummary();
    alert("일정 삭제 완료");
  }

  function getAggregateRows(targetDate, scope) {
    return schedules.filter(row => {
      if (String(row.date || "") !== String(targetDate || "")) return false;

      if (scope === "all" && typeof isAdminMode === "function" && isAdminMode()) {
        return true;
      }

      if (typeof currentStaffNo === "function") {
        return row.createdByNo === currentStaffNo();
      }
      return true;
    }).sort((a, b) => {
      const ak = `${a.assignee || ""} ${a.time || ""}`;
      const bk = `${b.assignee || ""} ${b.time || ""}`;
      return ak.localeCompare(bk, "ko");
    });
  }

  function groupByAssignee(rows) {
    return rows.reduce((acc, row) => {
      const key = row.assignee || "미지정";
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }

  function buildAggregateCopyText(dateStr, rows) {
    const grouped = groupByAssignee(rows);
    const lines = [`[익일취합] ${dateStr}`];

    Object.keys(grouped).forEach(name => {
      lines.push("");
      lines.push(`■ ${name}`);
      grouped[name].forEach((row, idx) => {
        const parts = [
          `${idx + 1}.`,
          row.time || "",
          row.company || "",
          row.people ? `/${row.people}` : "",
          row.manager ? `/${row.manager}` : "",
          row.phone ? `/${formatPhone(row.phone)}` : "",
          row.memo ? `/${row.memo}` : ""
        ].filter(Boolean);
        lines.push(parts.join(" "));
      });
    });

    return lines.join("\n");
  }

  function loadAggregate() {
    const dateEl = safeGet("aggDate");
    const scopeEl = safeGet("aggScope");
    const summaryEl = safeGet("aggregateSummary");
    const body = safeGet("aggregateTableBody");

    if (!summaryEl || !body) return;

    const targetDate = dateEl?.value || getTomorrowStr();
    const scope = scopeEl?.value || "mine";
    const rows = getAggregateRows(targetDate, scope);

    summaryEl.innerHTML = "";
    body.innerHTML = "";

    if (!rows.length) {
      summaryEl.innerHTML = `<div class="empty">해당 날짜 기준 익일취합 데이터가 없어.</div>`;
      body.innerHTML = `<tr><td colspan="7"><div class="empty">조회된 일정이 없어.</div></td></tr>`;
      return;
    }

    const staffSet = [...new Set(rows.map(r => r.assignee).filter(Boolean))];

    summaryEl.innerHTML = `
      <div class="stack-item">
        <b>${escapeHtml(targetDate)} 기준 익일취합</b>
        <span>총 ${rows.length}건 · 섭외자 ${staffSet.length}명 · ${escapeHtml(staffSet.join(", "))}</span>
        <div style="margin-top:10px;">
          <button class="small-btn" type="button" onclick="copyAggregateText()">익일취합 복사</button>
        </div>
      </div>
    `;

    rows.forEach(row => {
      body.innerHTML += `
        <tr>
          <td>${escapeHtml(row.assignee || "")}</td>
          <td>${escapeHtml(row.date || "")}</td>
          <td>${escapeHtml(row.time || "")}</td>
          <td>${escapeHtml(row.company || "")}</td>
          <td>${escapeHtml(row.manager || "")}</td>
          <td>${escapeHtml(formatPhone(row.phone || ""))}</td>
          <td>${escapeHtml(row.memo || "")}</td>
        </tr>
      `;
    });
  }

  function copyAggregateText() {
    const dateEl = safeGet("aggDate");
    const scopeEl = safeGet("aggScope");
    const targetDate = dateEl?.value || getTomorrowStr();
    const scope = scopeEl?.value || "mine";
    const rows = getAggregateRows(targetDate, scope);

    if (!rows.length) {
      alert("복사할 익일취합 데이터가 없어.");
      return;
    }

    safeCopy(buildAggregateCopyText(targetDate, rows));
  }

  function bindScheduleInputs() {
    const ids = [
      "scheduleAssignee",
      "scheduleDate",
      "scheduleCompany",
      "scheduleManager",
      "schedulePhone",
      "scheduleAddress",
      "schedulePeople",
      "scheduleGap",
      "scheduleBank",
      "scheduleMemo"
    ];

    ids.forEach(id => {
      const el = safeGet(id);
      if (!el) return;
      el.addEventListener("input", updateNateonPreview);
    });

    const timeEl = safeGet("scheduleTime");
    if (timeEl) {
      timeEl.addEventListener("input", updateNateonPreview);
      timeEl.addEventListener("blur", onTimeBlurAutoFormat);
    }
  }

  function initScheduleModule() {
    const dateEl = safeGet("scheduleDate");
    if (dateEl && !dateEl.value) dateEl.value = getTomorrowStr();

    const aggDate = safeGet("aggDate");
    if (aggDate && !aggDate.value) aggDate.value = getTomorrowStr();

    bindScheduleInputs();
    updateNateonPreview();
    renderSchedules();
    loadAggregate();
  }

  window.addSchedule = addSchedule;
  window.renderSchedules = renderSchedules;
  window.loadAggregate = loadAggregate;
  window.copyScheduleFullText = copyScheduleFullText;
  window.copyAggregateText = copyAggregateText;
  window.copyNateonPreview = copyNateonPreview;
  window.deleteScheduleByTs = deleteScheduleByTs;
  window.updateNateonPreview = updateNateonPreview;

  document.addEventListener("DOMContentLoaded", initScheduleModule);
})();
