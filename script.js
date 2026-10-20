/* ===================== ตั้งค่าการเชื่อมต่อ ===================== */
const USE_MOCK = true; // true = ทดสอบด้วยข้อมูลจำลอง, false = ส่งไป Apps Script จริง
const API_URL = ""; // ลิงก์ Web App ของ Apps Script (ใส่ในรอบ D)

/* ===================== ค่าตั้งต้น ===================== */
const MAX_IMAGE_SIDE = 1600; // ย่อรูปให้ด้านยาวสุดไม่เกินกี่ px
const JPEG_QUALITY = 0.8; // คุณภาพรูปหลังย่อ (0-1)
const MAX_RAW_IMAGE_MB = 25; // รูปต้นฉบับใหญ่ได้สุดเท่าไร (ก่อนย่อ)
let MASTER = { address: {}, faculty: {}, lists: {}, maxFileMb: 5 };
let submissionId =
  "S" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let saved = null; // {member_id, upload_token, status}
let pendingJobs = []; // ไฟล์ที่อัปโหลดไม่สำเร็จ

/* ===================== เรียกหลังบ้าน (จุดเดียวที่ต่างจากเดิม) ===================== */
async function call(fn, ...args) {
  if (USE_MOCK) return mockCall(fn, args);
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ fn, args }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

/* ข้อมูลจำลอง: ตอบแทน Apps Script ระหว่างทดสอบ */
async function mockCall(fn, args) {
  await new Promise((r) => setTimeout(r, 400)); // หน่วงเวลาให้เหมือนส่งผ่านเน็ต
  console.log("[MOCK]", fn, args); // ดูข้อมูลที่ส่งได้ใน Console
  if (fn === "getMasterData")
    return {
      address: {
        กรุงเทพมหานคร: {
          จตุจักร: { ลาดยาว: "10900", จตุจักร: "10900", เสนานิคม: "10900" },
        },
        นนทบุรี: { ปากเกร็ด: { ปากเกร็ด: "11120" } },
      },
      faculty: {
        บางเขน: {
          เศรษฐศาสตร์: ["เศรษฐศาสตร์", "เศรษฐศาสตร์เกษตรและทรัพยากร", "สหกรณ์"],
          บริหารธุรกิจ: ["การบัญชี", "การเงิน", "การตลาด", "การจัดการ"],
        },
      },
      lists: {
        occupation_group: [
          "ข้าราชการ / รัฐวิสาหกิจ",
          "พนักงานบริษัทเอกชน",
          "ธุรกิจส่วนตัว",
          "เกษตรกร",
          "อาจารย์ / นักวิชาการ",
          "อื่นๆ",
        ],
        degree: ["ปริญญาตรี", "ปริญญาโท", "ปริญญาเอก"],
        affiliation: ["สมก.", "สมาชิกคณะมนุษยศาสตร์", "นิสิตเก่า"],
      },
      maxFileMb: 5,
    };
  if (fn === "precheck") return [];
  if (fn === "submitForm")
    return {
      ok: true,
      member_id: "M00001",
      status: "pending",
      upload_token: "mock-token",
    };
  if (fn === "uploadFile") return { ok: true, file_id: "mock-file" };
  if (fn === "finalizeSubmission") return { ok: true, status: "pending" };
  throw new Error("ไม่รู้จักคำสั่ง " + fn);
}

/* ===================== helpers ===================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
function opts(sel, list, ph = "เลือก...") {
  sel.innerHTML =
    `<option value="">${ph}</option>` +
    list.map((v) => `<option>${esc(v)}</option>`).join("");
}
function showAlert(type, title, body = "") {
  $("#alertBox").innerHTML = type
    ? `<div class="alert a-${type}" role="alert"><strong>${title}</strong>${body}</div>`
    : "";
  if (type) window.scrollTo({ top: 0, behavior: "smooth" });
}
const dupHtml = (list) =>
  list
    .map(
      (d) =>
        `รหัส ${esc(d.member_id)} (${esc(d.name)}) ตรงกันที่ ${d.why.join(", ")}`,
    )
    .join("<br>");

/* ===================== ธีมสี ===================== */
const DEFAULT_THEME = "light"; // 'light' | 'dark' | 'auto' (auto = ตามการตั้งค่าเครื่อง)
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $("#themeBtn").textContent = t === "dark" ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด";
}
(function initTheme() {
  let t = null;
  try {
    t = localStorage.getItem("ku-theme");
  } catch (e) {}
  if (!t)
    t =
      DEFAULT_THEME === "auto"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : DEFAULT_THEME;
  applyTheme(t);
})();
$("#themeBtn").onclick = () => {
  const t =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(t);
  try {
    localStorage.setItem("ku-theme", t);
  } catch (e) {}
};

/* ===================== โหลด master data ===================== */
call("getMasterData")
  .then((data) => {
    MASTER = data;
    opts($("#occupation_group"), MASTER.lists.occupation_group || []);
    $("#affil").innerHTML = (MASTER.lists.affiliation || [])
      .map(
        (v) =>
          `<label><input type="checkbox" value="${esc(v)}"${v === "นิสิตเก่า" ? " checked" : ""}>${esc(v)}</label>`,
      )
      .join("");
    $("[data-addr=home]").insertAdjacentHTML("beforeend", addrFields(true));
    initAddr($("[data-addr=home]"));
    addWork();
    addEdu();
    $("#loading").classList.add("hidden");
    $("#f").classList.remove("hidden");
  })
  .catch((e) =>
    showAlert("err", "โหลดแบบฟอร์มไม่สำเร็จ", "กรุณารีเฟรชหน้านี้อีกครั้ง"),
  );

/* ===================== ที่อยู่: จังหวัด > อำเภอ > ตำบล > รหัสไปรษณีย์ ===================== */
let uid = 0;
function addrFields(required) {
  const r = required ? " req" : "",
    d = required ? " data-req" : "",
    i = ++uid;
  return `
  <div class="c3"><label class="f${r}" for="p${i}">จังหวัด</label><select id="p${i}" data-role="prov" data-k="province"${d}></select><div class="err"></div></div>
  <div class="c3"><label class="f${r}" for="d${i}">เขต / อำเภอ</label><select id="d${i}" data-role="dist" data-k="district"${d}></select><div class="err"></div></div>
  <div class="c3"><label class="f${r}" for="s${i}">แขวง / ตำบล</label><select id="s${i}" data-role="sub" data-k="subdistrict"${d}></select><div class="err"></div></div>
  <div class="c3"><label class="f${r}" for="z${i}">รหัสไปรษณีย์</label><input type="text" id="z${i}" data-role="zip" data-k="postcode" inputmode="numeric"${d}><div class="err"></div></div>
  <div class="c6"><label class="f" for="m${i}">ลิงก์ Google Maps</label><input type="url" id="m${i}" data-k="map_url" placeholder="https://maps.app.goo.gl/..."></div>
  <div class="c6" style="align-self:end"><label class="inline" style="gap:6px"><input type="checkbox" data-k="map_public">อนุญาตให้เผยแพร่ตำแหน่งบนแผนที่</label></div>`;
}
function initAddr(scope) {
  opts(
    $("[data-role=prov]", scope),
    Object.keys(MASTER.address).sort((a, b) => a.localeCompare(b, "th")),
  );
  opts($("[data-role=dist]", scope), []);
  opts($("[data-role=sub]", scope), []);
}
document.addEventListener("change", (e) => {
  const t = e.target,
    scope = t.closest("[data-addr]");
  if (!scope) return;
  const p = $("[data-role=prov]", scope),
    d = $("[data-role=dist]", scope),
    s = $("[data-role=sub]", scope),
    z = $("[data-role=zip]", scope);
  const A = MASTER.address;
  if (t === p) {
    opts(
      d,
      p.value
        ? Object.keys(A[p.value]).sort((a, b) => a.localeCompare(b, "th"))
        : [],
    );
    opts(s, []);
    z.value = "";
  }
  if (t === d) {
    opts(
      s,
      d.value
        ? Object.keys(A[p.value][d.value]).sort((a, b) =>
            a.localeCompare(b, "th"),
          )
        : [],
    );
    z.value = "";
  }
  if (t === s) {
    z.value = s.value ? A[p.value][d.value][s.value] : "";
    setErr(z, "");
  }
});

/* ===================== section ที่เพิ่ม/ลบได้ ===================== */
function addWork() {
  const n = $$("#workList .card").length + 1;
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.addr = "work";
  el.innerHTML = `<div class="card-h"><span>สถานที่ทำงาน ${n}</span>${n > 1 ? '<button type="button" class="b-del">ลบ</button>' : ""}</div>
  <div class="grid">
    <div class="c3"><label class="f">ปี พ.ศ. เริ่มทำงาน</label><input type="text" data-k="start_year_be" inputmode="numeric" placeholder="2563"></div>
    <div class="c3"><label class="f">ถึงปี พ.ศ.</label><input type="text" data-k="end_year_be" inputmode="numeric" placeholder="ว่าง = ปัจจุบัน"></div>
    <div class="c3"><label class="f req">ที่อยู่ที่ทำงาน</label><input type="text" data-k="address" data-req><div class="err"></div></div>
    <div class="c3"><label class="f">ชื่อบริษัท / ร้านค้า / หน่วยงาน</label><input type="text" data-k="company"></div>
    ${addrFields(true)}
    <div class="c12"><label class="f">รูปภาพกิจการของสมาชิก</label><input type="file" data-file="business_photo" accept="image/*"><div class="err"></div></div>
  </div>`;
  $("#workList").appendChild(el);
  initAddr(el);
}
function addEdu() {
  const n = $$("#eduList .card").length + 1;
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.edu = "1";
  el.innerHTML = `<div class="card-h"><span>วุฒิการศึกษา ${n}</span>${n > 1 ? '<button type="button" class="b-del">ลบ</button>' : ""}</div>
  <div class="grid">
    <div class="c4"><label class="f req">วุฒิการศึกษา</label><select data-k="degree" data-req></select><div class="err"></div></div>
    <div class="c4"><label class="f req">วิทยาเขต</label><select data-k="campus" data-role="campus" data-req></select><div class="err"></div></div>
    <div class="c4"><label class="f req">คณะ</label><select data-k="faculty" data-role="faculty" data-req></select><div class="err"></div></div>
    <div class="c6"><label class="f req">ภาควิชา</label><select data-k="department" data-role="dept" data-req></select><div class="err"></div></div>
    <div class="c6"><label class="f">สาขา</label><input type="text" data-k="major"></div>
    <div class="c3"><label class="f">รุ่นสาขาวิชา</label><input type="text" data-k="major_gen"></div>
    <div class="c3"><label class="f">รุ่นคณะ</label><input type="text" data-k="faculty_gen"></div>
    <div class="c3"><label class="f">รหัสนิสิต</label><input type="text" data-k="student_id" inputmode="numeric"></div>
    <div class="c3"><label class="f">รุ่น KU</label><div class="addon"><span>KU</span><input type="text" data-k="ku_gen" inputmode="numeric"></div></div>
    <div class="c3"><label class="f">ปีที่เข้าศึกษา (พ.ศ.)</label><input type="text" data-k="entry_year_be" inputmode="numeric"></div>
    <div class="c3"><label class="f">ปีที่จบการศึกษา (พ.ศ.)</label><input type="text" data-k="grad_year_be" inputmode="numeric"></div>
  </div>`;
  $("#eduList").appendChild(el);
  opts($("[data-k=degree]", el), MASTER.lists.degree || []);
  opts($("[data-role=campus]", el), Object.keys(MASTER.faculty));
  opts($("[data-role=faculty]", el), []);
  opts($("[data-role=dept]", el), []);
}
document.addEventListener("change", (e) => {
  const card = e.target.closest("[data-edu]");
  if (!card) return;
  const c = $("[data-role=campus]", card),
    f = $("[data-role=faculty]", card),
    d = $("[data-role=dept]", card);
  if (e.target === c) {
    opts(f, c.value ? Object.keys(MASTER.faculty[c.value]) : []);
    opts(d, []);
  }
  if (e.target === f) {
    opts(d, f.value ? MASTER.faculty[c.value][f.value] : []);
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("b-del")) return;
  const card = e.target.closest(".card"),
    list = card.parentElement;
  card.remove();
  const label = list.id === "workList" ? "สถานที่ทำงาน" : "วุฒิการศึกษา";
  $$(".card", list).forEach(
    (c, i) =>
      (c.querySelector(".card-h span").textContent = `${label} ${i + 1}`),
  );
});
$("#addWork").onclick = addWork;
$("#addEdu").onclick = addEdu;

/* ===================== validation ===================== */
function setErr(el, msg) {
  const box =
    el.parentElement.querySelector(".err") ||
    el.closest(".addon")?.parentElement.querySelector(".err");
  if (box) box.textContent = msg || "";
  el.setAttribute("aria-invalid", msg ? "true" : "false");
}
document.addEventListener("input", (e) => {
  if (e.target.matches("input,select")) setErr(e.target, "");
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.type === "file" && t.files[0]) {
    const f = t.files[0],
      mb = f.size / 1048576;
    const isImg = f.type.startsWith("image/"),
      isPdf = f.type === "application/pdf";
    let msg = "";
    if (!isImg && !isPdf) msg = "รับเฉพาะรูปภาพหรือ PDF";
    else if (isPdf && mb > MASTER.maxFileMb)
      msg = `PDF ใหญ่เกิน ${MASTER.maxFileMb} MB`;
    else if (isImg && mb > MAX_RAW_IMAGE_MB)
      msg = `รูปใหญ่เกิน ${MAX_RAW_IMAGE_MB} MB`;
    if (msg) {
      t.value = "";
      setErr(t, msg);
    } else setErr(t, "");
  }
  if (t.name === "gender") $("#gender_err").textContent = "";
  if (t.closest("#affil")) $("#affil_err").textContent = "";
  if (t.id === "consent") $("#consent_err").textContent = "";
});
function validate(stepId) {
  const sec = $("#" + stepId);
  let first = null;
  $$("[data-req]", sec).forEach((el) => {
    const ok = el.value.trim() !== "";
    setErr(el, ok ? "" : "กรอกช่องนี้");
    if (!ok && !first) first = el;
  });
  if (stepId === "step1") {
    const em = $("#email"),
      ph = $("#phone");
    if (em.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) {
      setErr(em, "รูปแบบอีเมลไม่ถูกต้อง");
      first = first || em;
    }
    if (ph.value && ph.value.replace(/\D/g, "").length < 9) {
      setErr(ph, "เบอร์โทรต้องมีอย่างน้อย 9 หลัก");
      first = first || ph;
    }
    if (!$("[name=gender]:checked")) {
      $("#gender_err").textContent = "เลือกเพศ";
      first = first || $("[name=gender]");
    }
    if (!$$("#affil input:checked").length) {
      $("#affil_err").textContent = "เลือกอย่างน้อย 1 สังกัด";
      first = first || $("#affil input");
    }
    if (!$("#file_proof").files.length) {
      setErr($("#file_proof"), "แนบหลักฐานการสมัครอย่างน้อย 1 ไฟล์");
      first = first || $("#file_proof");
    }
  }
  if (stepId === "step3" && !$("#consent").checked) {
    $("#consent_err").textContent = "ต้องยินยอมก่อนบันทึก";
    first = first || $("#consent");
  }
  if (first) first.focus();
  return !first;
}

/* ===================== เปลี่ยน step ===================== */
let step = 1;
function go(n) {
  ["step1", "step2", "step3", "done"].forEach((id) =>
    $("#" + id).classList.toggle(
      "hidden",
      id !== (n === "done" ? "done" : "step" + n),
    ),
  );
  [1, 2, 3].forEach((i) => {
    const s = $("#s" + i);
    s.classList.toggle("on", i === n);
    s.classList.toggle("done", n === "done" || i < n);
  });
  step = n;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.addEventListener("click", async (e) => {
  const g = e.target.dataset.go;
  if (!g) return;
  const n = +g;
  if (n > step && !validate("step" + step)) return;
  if (step === 1 && n === 2) {
    e.target.disabled = true;
    try {
      const hard = await call("precheck", $("#email").value, $("#phone").value);
      if (hard.length) {
        showAlert(
          "err",
          "ข้อมูลนี้ลงทะเบียนไว้แล้ว",
          dupHtml(hard) + "<br>หากต้องการแก้ไขข้อมูล กรุณาติดต่อแอดมิน",
        );
        return;
      }
    } catch (err) {
      /* เช็กไม่ได้ก็ให้ไปต่อ server จะเช็กซ้ำอีกรอบตอนบันทึก */
    } finally {
      e.target.disabled = false;
    }
  }
  showAlert();
  go(n);
});

/* ===================== รวบรวมข้อมูล ===================== */
function readBlock(el) {
  const o = {};
  $$("[data-k]", el).forEach(
    (i) =>
      (o[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value.trim()),
  );
  return o;
}
function collect() {
  const member = {};
  $$("[data-m]").forEach((i) => (member[i.id] = i.value.trim()));
  member.gender = ($("[name=gender]:checked") || {}).value || "";
  member.affiliation = $$("#affil input:checked")
    .map((c) => c.value)
    .join(",");
  const home = readBlock($("[data-addr=home]"));
  Object.assign(member, {
    home_address: $("#home_address").value.trim(),
    home_province: home.province,
    home_district: home.district,
    home_subdistrict: home.subdistrict,
    home_postcode: home.postcode,
    home_map_url: home.map_url,
    home_map_public: home.map_public,
  });
  return {
    submission_id: submissionId,
    website: $("#website").value,
    consent: $("#consent").checked,
    member,
    workplaces: $$("#workList .card").map(readBlock),
    educations: $$("#eduList .card").map(readBlock),
  };
}
function fileJobs() {
  const jobs = [];
  [
    ["file_proof", "proof"],
    ["file_student_photo", "student_photo"],
    ["file_current_photo", "current_photo"],
  ].forEach(([id, type]) => {
    const f = $("#" + id).files[0];
    if (f) jobs.push({ file: f, type });
  });
  $$("#workList .card").forEach((c, i) => {
    const f = $("[data-file]", c).files[0];
    if (f) jobs.push({ file: f, type: "business_photo_" + (i + 1) });
  });
  return jobs;
}

/* ===================== ย่อรูป / แปลงไฟล์เป็น base64 ===================== */
function readAsBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
async function prepareFile(file) {
  if (file.type === "application/pdf")
    return { mime: "application/pdf", data: await readAsBase64(file) };
  let img;
  try {
    img = await loadImage(file);
  } catch (e) {
    throw new Error(
      "เปิดรูปนี้ไม่ได้ (อาจเป็นไฟล์ HEIC) กรุณาเลือกไฟล์ JPG หรือ PNG",
    );
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise((r) =>
    canvas.toBlob(r, "image/jpeg", JPEG_QUALITY),
  );
  return { mime: "image/jpeg", data: await readAsBase64(blob) };
}

/* ===================== บันทึก ===================== */
const progress = (t) => ($("#progress").textContent = t);
$("#saveBtn").onclick = async () => {
  if (!validate("step3")) return;
  const btn = $("#saveBtn");
  btn.disabled = true;
  $("#backBtn").disabled = true;
  try {
    if (!saved) {
      progress("กำลังบันทึกข้อมูล...");
      const res = await call("submitForm", collect());
      if (!res.ok) {
        if (res.code === "DUPLICATE")
          showAlert(
            "err",
            "บันทึกไม่ได้ เพราะข้อมูลนี้ลงทะเบียนไว้แล้ว",
            dupHtml(res.matches) +
              "<br>หากต้องการแก้ไขข้อมูล กรุณาติดต่อแอดมิน",
          );
        else showAlert("err", "บันทึกไม่สำเร็จ", esc(res.message));
        return;
      }
      saved = res;
    }
    pendingJobs = await uploadAll(fileJobs());
    await finish();
  } catch (err) {
    showAlert(
      "err",
      "เชื่อมต่อไม่สำเร็จ",
      "กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดบันทึกอีกครั้ง ข้อมูลจะไม่ถูกบันทึกซ้ำ",
    );
  } finally {
    btn.disabled = false;
    $("#backBtn").disabled = false;
    progress("");
  }
};
async function uploadAll(jobs) {
  const failed = [];
  for (let i = 0; i < jobs.length; i++) {
    progress(`กำลังอัปโหลดไฟล์ ${i + 1} / ${jobs.length}...`);
    try {
      const prep = await prepareFile(jobs[i].file);
      const r = await call("uploadFile", {
        member_id: saved.member_id,
        token: saved.upload_token,
        file_type: jobs[i].type,
        name: jobs[i].file.name,
        mime: prep.mime,
        data: prep.data,
      });
      if (!r.ok) throw new Error(r.message);
    } catch (err) {
      failed.push(
        Object.assign({}, jobs[i], {
          reason: err.message || "อัปโหลดไม่สำเร็จ",
        }),
      );
    }
  }
  return failed;
}
async function finish() {
  const fin = await call(
    "finalizeSubmission",
    saved.member_id,
    saved.upload_token,
  );
  const status = fin.ok ? fin.status : saved.status;
  let html = `<div class="alert a-ok"><strong>บันทึกเรียบร้อย รหัสสมาชิก ${esc(saved.member_id)}</strong>กรุณาเก็บรหัสนี้ไว้สำหรับติดต่อแอดมิน</div>`;
  if (status === "possible_duplicate")
    html += `<div class="alert a-warn"><strong>รอแอดมินตรวจสอบ</strong>ชื่อของคุณคล้ายกับสมาชิกที่มีอยู่แล้ว แอดมินจะตรวจสอบและติดต่อกลับ</div>`;
  if (pendingJobs.length)
    html += `<div class="alert a-warn"><strong>มีไฟล์ที่อัปโหลดไม่สำเร็จ</strong>${pendingJobs.map((j) => esc(j.file.name) + ": " + esc(j.reason)).join("<br>")}</div>`;
  $("#doneBody").innerHTML = html;
  $("#retryBtn").classList.toggle("hidden", !pendingJobs.length);
  showAlert();
  go("done");
}
$("#retryBtn").onclick = async () => {
  const b = $("#retryBtn");
  b.disabled = true;
  b.textContent = "กำลังอัปโหลด...";
  try {
    pendingJobs = await uploadAll(pendingJobs);
    await finish();
  } finally {
    b.disabled = false;
    b.textContent = "อัปโหลดไฟล์ที่ไม่สำเร็จอีกครั้ง";
  }
};
