/* =========================================================
   LUWON CRM - schedule.js
   일정등록 / 중복검사 / 네이트온 복사 / 익일취합
   ---------------------------------------------------------
   전제:
   - index.html 에 아래 전역이 이미 있어야 함
     state, schedules, $, escapeHtml,
     todayStr(), tomorrowStr(),
     currentStaffNo(), currentStaffName(), isAdminMode(),
     runHomeSummary()
   ========================================================= */

(function () {
  "use strict";

  const ScheduleModule = {
    init,
    renderSchedules,
    addSchedule,
    seedExampleSchedule,
    loadAggregate,
    copyScheduleAsNateon,
    copyAggregateAsNateon,
    deleteScheduleByCreatedAt,
    updateScheduleStatus
  };

  function init() {
    safeSetDefaultDates();
    renderSchedules();
    loadAggregate();
  }

  function safeSetDefaultDates() {
    const aggDate = $("aggDate");
    if (aggDate && !aggDate.value) aggDate.value = tomorrowStr();

    const scheduleDate = $("scheduleDate");
    if (scheduleDate && !scheduleDate.value) scheduleDate.value = tomorrowStr();
  }

  /* =========================================================
     공통 유틸
     ========================================================= */

  function normalizeText(v) {
    return String(v || "").trim();
  }

  function normalizePhone(v) {
    const d = String(v || "").replace(/\D/g, "");
    if (!d) return "";
    if (/^01[016789]/.test(d)) {
      if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
      if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    }
    if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return String(v || "").trim();
  }

  function normalizeTime(v) {
    const s = String(v || "").trim();
    if (!s) return "";

    if (/^\d{1,2}:\d{2}$/.test(s)) {
      const [h, m] = s.split(":");
      return `${String(Number(h)).padStart(2, "0")}:${m}`;
    }

    const digits = s.replace(/\D/g, "");
    if (digits.length === 3) {
      return `0${digits[0]}:${digits.slice(1)}`;
    }
    if (digits.length === 4) {
      return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }

    return s;
  }

  function safeCopy(text) {
    if (!text) return Promise.reject(new Error("복사할 텍스트가 없습니다."));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error("복사 실패"));
      } catch (e) {
        reject(e);
      }
    });
  }

  function getScheduleRowsByScope() {
    if (isAdminMode()) return schedules;
    return schedules.filter(row => row.createdByNo === currentStaffNo());
  }

  function getVisibleScheduleRowsSorted() {
    return getScheduleRowsByScope()
      .slice()
      .sort((a, b) => {
        const aKey = `${a.date || ""} ${a.time || ""}`;
        const bKey = `${b.date || ""} ${b.time || ""}`;
        return aKey.localeCompare(bKey, "ko");
      });
  }

  function isDuplicateSchedule(payload) {
    return schedules.some(row => {
      const sameDate = String(row.date || "") === String(payload.date || "");
      const sameTime = String(row.time || "") === String(payload.time || "");
      const sameAssignee = String(row.assignee || "") === String(payload.assignee || "");
      const samePhone = normalizePhone(row.phone) && normalizePhone(row.phone) === normalizePhone(payload.phone);
      const sameCompany = normalizeText(row.company) && normalizeText(row.company) === normalizeText(payload.company);

      return sameDate && sameTime && sameAssignee && (samePhone || sameCompany);
    });
  }

  function buildSchedulePayloadFromForm() {
    const assignee = normalizeText($("scheduleAssignee")?.value) || currentStaffName();
    const date = normalizeText($("scheduleDate")?.value);
    const time = normalizeTime($("scheduleTime")?.value);
    const company = normalizeText($("scheduleCompany")?.value);
    const manager = normalizeText($("scheduleManager")?.value);
    const phone = normalizePhone($("schedulePhone")?.value);
    const address = normalizeText($("scheduleAddress")?.value);
    const people = normalizeText($("schedulePeople")?.value);
    const gap = normalizeText($("scheduleGap")?.value);
    const bank = normalizeText($("scheduleBank")?.value);
    const memo = normalizeText($("scheduleMemo")?.value);

    return {
      assignee,
      date,
      time,
      company,
      manager,
      phone,
      address,
      people,
      gap,
      bank,
      memo,
      status: "등록완료",
      createdBy: currentStaffName(),
      createdByNo: currentStaffNo(),
      createdAt: todayStr(),
      createdAtTs: Date.now()
    };
  }

  function validateSchedulePayload(payload) {
    if (!payload.assignee) return "섭외자는 꼭 입력해줘.";
    if (!payload.date) return "날짜는 꼭 입력해줘.";
    if (!payload.time) return "시간은 꼭 입력해줘.";
    if (!payload.company) return "업체명은 꼭 입력해줘.";
    return "";
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
      const el = $(id);
      if (el) el.value = "";
    });

    const dateEl = $("scheduleDate");
    if (dateEl) dateEl.value = tomorrowStr();
  }

  /* =========================================================
     네이트온 문구 생성
     ========================================================= */

  function formatScheduleForNateon(row) {
    const lines = [];
    lines.push(`[일정등록]`);
    lines.push(`섭외자 : ${row.assignee || ""}`);
    lines.push(`날짜 : ${row.date || ""}`);
    lines.push(`시간 : ${row.time || ""}`);
    if (row.company) lines.push(`업체명 : ${row.company}`);
    if (row.manager) lines.push(`키맨 : ${row.manager}`);
    if (row.phone) lines.push(`연락처 : ${normalizePhone(row.phone)}`);
    if (row.address) lines.push(`주소 : ${row.address}`);
    if (row.people) lines.push(`인원 : ${row.people}`);
    if (row.gap) lines.push(`갑사 : ${row.gap}`);
    if (row.bank) lines.push(`은행 : ${row.bank}`);
    if (row.memo) lines.push(`특이사항 : ${row.memo}`);
    lines.push(`등록자 : ${row.createdBy || ""}`);
    return lines.join("\n");
  }

  function formatAggregateForNateon(date, rows) {
    const lines = [];
    lines.push(`[익일취합] ${date}`);

    const grouped = groupByAssignee(rows);
    Object.keys(grouped).forEach(name => {
      lines.push("");
      lines.push(`■ ${name}`);
      grouped[name].forEach((row, idx) => {
        const parts = [];
        parts.push(`${idx + 1}. ${row.time || "--:--"}`);
        if (row.company) parts.push(row.company);
        if (row.manager) parts.push(`/ ${row.manager}`);
        if (row.phone) parts.push(`/ ${normalizePhone(row.phone)}`);
        if (row.people) parts.push(`/ ${row.people}`);
        if (row.memo) parts.push(`/ ${row.memo}`);
        lines.push(parts.join(" "));
      });
    });

    return lines.join("\n");
  }

  function groupByAssignee(rows) {
    return rows.reduce((acc, row) => {
      const key = row.assignee || "미지정";
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }

  /* =========================================================
     일정등록
     ========================================================= */

  function seedExampleSchedule() {
    if ($("scheduleAssignee")) $("scheduleAssignee").value = currentStaffName();
    if ($("scheduleDate")) $("scheduleDate").value = tomorrowStr();
    if ($("scheduleTime")) $("scheduleTime").value = "14:00";
    if ($("scheduleCompany")) $("scheduleCompany").value = "예시업체";
    if ($("scheduleManager")) $("scheduleManager").value = "홍길동";
    if ($("schedulePhone")) $("schedulePhone").value = "01000000000";
    if ($("scheduleAddress")) $("scheduleAddress").value = "인천 서구 예시로 123";
    if ($("schedulePeople")) $("schedulePeople").value = "3명";
    if ($("scheduleGap")) $("scheduleGap").value = "갑사";
    if ($("scheduleBank")) $("scheduleBank").value = "국민";
    if ($("scheduleMemo")) $("scheduleMemo").value = "예시 메모";
  }

  function addSchedule() {
    if (!state.currentUser) return;

    const payload = buildSchedulePayloadFromForm();
    const err = validateSchedulePayload(payload);
    if (err) {
      alert(err);
      return;
    }

    if (isDuplicateSchedule(payload)) {
      const go = confirm("같은 날짜/시간대의 비슷한 일정이 이미 있어. 그래도 등록할까?");
      if (!go) return;
    }

    schedules.unshift(payload);

    renderSchedules();
    loadAggregate();
    if (typeof runHomeSummary === "function") runHomeSummary();

    const nateonText = formatScheduleForNateon(payload);
    safeCopy(nateonText)
      .then(() => {
        clearScheduleForm();
        alert("일정 추가 완료\n네이트온 양식도 자동 복사했어.");
      })
      .catch(() => {
        clearScheduleForm();
        alert("일정 추가 완료\n복사는 자동으로 안 됐어. 복사 버튼으로 다시 해줘.");
      });
  }

  function renderSchedules() {
    const body = $("scheduleTableBody");
    if (!body) return;

    const rows = getVisibleScheduleRowsSorted();
    body.innerHTML = "";

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="10"><div class="empty">등록된 일정이 없어.</div></td></tr>`;
      return;
    }

    rows.forEach((row) => {
      const nateonText = formatScheduleForNateon(row);
      body.innerHTML += `
        <tr>
          <td>${escapeHtml(row.assignee || "")}</td>
          <td>${escapeHtml(row.date || "")}</td>
          <td>${escapeHtml(row.time || "")}</td>
          <td>${escapeHtml(row.company || "")}</td>
          <td>${escapeHtml(row.manager || "")}</td>
          <td>${escapeHtml(normalizePhone(row.phone || ""))}</td>
          <td>${escapeHtml(row.people || "")}</td>
          <td>${escapeHtml(row.gap || "")}</td>
          <td>${escapeHtml(row.memo || "")}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="ghost-btn" type="button" onclick='copyScheduleAsNateon(${JSON.stringify(row.createdAtTs)})'>복사</button>
              <button class="ghost-btn" type="button" onclick='updateScheduleStatus(${JSON.stringify(row.createdAtTs)}, "확인완료")'>확인</button>
              <button class="danger-btn" type="button" onclick='deleteScheduleByCreatedAt(${JSON.stringify(row.createdAtTs)})'>삭제</button>
            </div>
            <div style="margin-top:6px;font-size:12px;color:#6b7a90;">
              ${escapeHtml(row.status || "등록완료")}
            </div>
          </td>
        </tr>
      `;
    });
  }

  function copyScheduleAsNateon(createdAtTs) {
    const row = schedules.find(x => Number(x.createdAtTs) === Number(createdAtTs));
    if (!row) {
      alert("일정을 찾을 수 없어.");
      return;
    }

    safeCopy(formatScheduleForNateon(row))
      .then(() => alert("네이트온 양식 복사 완료"))
      .catch(() => alert("복사 실패"));
  }

  function deleteScheduleByCreatedAt(createdAtTs) {
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

  function updateScheduleStatus(createdAtTs, nextStatus) {
    const row = schedules.find(x => Number(x.createdAtTs) === Number(createdAtTs));
    if (!row) {
      alert("일정을 찾을 수 없어.");
      return;
    }

    row.status = nextStatus || "확인완료";
    renderSchedules();
  }

  /* =========================================================
     익일취합
     ========================================================= */

  function getAggregateRows(dateValue, scopeValue) {
    const targetDate = dateValue || tomorrowStr();
    return schedules
      .filter(row => {
        if (String(row.date || "") !== String(targetDate)) return false;
        if (scopeValue === "all" && isAdminMode()) return true;
        return row.createdByNo === currentStaffNo();
      })
      .slice()
      .sort((a, b) => {
        const aKey = `${a.assignee || ""} ${a.time || ""}`;
        const bKey = `${b.assignee || ""} ${b.time || ""}`;
        return aKey.localeCompare(bKey, "ko");
      });
  }

  function loadAggregate() {
    const body = $("aggregateTableBody");
    const summary = $("aggregateSummary");
    const dateEl = $("aggDate");
    const scopeEl = $("aggScope");

    if (!body || !summary) return;

    const targetDate = dateEl ? (dateEl.value || tomorrowStr()) : tomorrowStr();
    const scope = scopeEl ? scopeEl.value : "mine";
    const rows = getAggregateRows(targetDate, scope);

    summary.innerHTML = "";
    body.innerHTML = "";

    if (!rows.length) {
      summary.innerHTML = `<div class="empty">해당 날짜 기준 익일취합 데이터가 없어.</div>`;
      body.innerHTML = `<tr><td colspan="8"><div class="empty">조회된 일정이 없어.</div></td></tr>`;
      return;
    }

    const grouped = groupByAssignee(rows);
    const staffNames = Object.keys(grouped);

    summary.innerHTML = `
      <div class="stack-item">
        <b>${escapeHtml(targetDate)} 기준 익일취합</b>
        <span>총 ${rows.length}건 · 섭외자 ${staffNames.length}명</span>
        <div style="margin-top:10px;">
          <button class="small-btn" type="button" onclick='copyAggregateAsNateon()'>익일취합 복사</button>
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
          <td>${escapeHtml(normalizePhone(row.phone || ""))}</td>
          <td>${escapeHtml(row.people || "")}</td>
          <td>${escapeHtml(row.memo || "")}</td>
        </tr>
      `;
    });
  }

  function copyAggregateAsNateon() {
    const dateEl = $("aggDate");
    const scopeEl = $("aggScope");
    const targetDate = dateEl ? (dateEl.value || tomorrowStr()) : tomorrowStr();
    const scope = scopeEl ? scopeEl.value : "mine";
    const rows = getAggregateRows(targetDate, scope);

    if (!rows.length) {
      alert("복사할 익일취합 데이터가 없어.");
      return;
    }

    const text = formatAggregateForNateon(targetDate, rows);
    safeCopy(text)
      .then(() => alert("익일취합 양식 복사 완료"))
      .catch(() => alert("복사 실패"));
  }

  /* =========================================================
     전역 연결
     ========================================================= */

  window.seedExampleSchedule = seedExampleSchedule;
  window.renderSchedules = renderSchedules;
  window.addSchedule = addSchedule;
  window.loadAggregate = loadAggregate;
  window.copyScheduleAsNateon = copyScheduleAsNateon;
  window.copyAggregateAsNateon = copyAggregateAsNateon;
  window.deleteScheduleByCreatedAt = deleteScheduleByCreatedAt;
  window.updateScheduleStatus = updateScheduleStatus;

  window.ScheduleModule = ScheduleModule;

  document.addEventListener("DOMContentLoaded", init);
})();
