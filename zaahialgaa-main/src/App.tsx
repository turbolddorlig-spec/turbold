import React, { useEffect, useMemo, useState } from "react";

/* ----------------- Constants & Utils ----------------- */
const STATUSES = [
  "Хятадаас худалдан авч байна",
  "Тээвэрт гарсан",
  "Эрээнд ирсэн",
  "Монголд ирсэн",
  "Ирж авсан",
  "Хүргэлтэд гарсан",
  "Хүргэгдсэн",
];

// Төгсгөлийн (дууссан) статусууд
const FINAL_STATUSES = ["Ирж авсан", "Хүргэгдсэн"];

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(d?: string) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString();
  } catch {
    return d as string;
  }
}

function random4() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function makeTrackingCode(prefix = "DG") {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${day}-${random4()}`;
}

const STORAGE_KEY = "orders_v1";
const SETTINGS_KEY = "settings_v2"; // ← шинэ түлхүүр, хуучин localStorage-г дарж уншихгүй

function loadOrders() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return [];
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveOrders(list: any[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function saveSettings(obj: any) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
}

/* ----------------- App ----------------- */
export default function App() {
  const [tab, setTab] = useState<"customer" | "admin">("customer");
  const [orders, setOrders] = useState<any[]>(loadOrders());
  const [settings, setSettings] = useState(
    loadSettings() || {
      brand: "DELGUUR",
      adminPIN: "2468",
      prefix: "DG",
    }
  );

  useEffect(() => saveOrders(orders), [orders]);
  useEffect(() => saveSettings(settings), [settings]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-xl font-bold">
                Загалмай захиалгын бараа үйлдвэрийн үнээр
              </h1>
              <p className="text-xs text-gray-500">{settings.brand}</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setTab("customer")}
              className={`px-3 py-2 rounded-2xl text-sm font-medium ${
                tab === "customer"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow"
                  : "hover:bg-gray-100"
              }`}
            >
              Хэрэглэгч
            </button>
            <button
              onClick={() => setTab("admin")}
              className={`px-3 py-2 rounded-2xl text-sm font-medium ${
                tab === "admin"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow"
                  : "hover:bg-gray-100"
              }`}
            >
              Админ
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "customer" ? (
          <CustomerView orders={orders} />
        ) : (
          <AdminView
            orders={orders}
            setOrders={setOrders}
            settings={settings}
            setSettings={setSettings}
          />
        )}
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-500 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} Захиалга Tracking MVP</div>
          <div className="flex gap-4">
            <span>Статусууд: {STATUSES.length}</span>
            <span>Өнөөдөр: {todayISO()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------- Customer ----------------- */
function CustomerView({ orders }: { orders: any[] }) {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  // null=эхлэх үе, []=олдоогүй, [...]=илэрцүүд

  const normalize = (s: string) => String(s || "").replace(/\D/g, "");
  // тооноос бусдыг авч хаяна (зай, "-" гэх мэт)

  function handleFind() {
    const c = code.trim();
    const p = normalize(phone);
    let list = [];

    if (c) {
      // Код оруулсан бол зөвхөн тэр кодтой НЭГ захиалгыг хайж харуулна
      const byCode = orders.find(
        (o) => (o.trackingCode || "").toUpperCase() === c.toUpperCase()
      );
      if (byCode) list = [byCode];
    } else if (p) {
      const now = Date.now();
      const daysBetween = (d: string) =>
        (now - new Date(d).getTime()) / (1000 * 60 * 60 * 24);

      list = orders
        .filter((o) => {
          if (normalize(o.phone) !== p) return false;

          // Зөвхөн хэрэглэгч талд нуух логик:
          // Хэрэв статус нь “Ирж авсан/Хүргэгдсэн” бол
          // статус солигдсон огнооноос 14 хоног өнгөрсөн эсэхийг шалгана.
          if (FINAL_STATUSES.includes(o.status)) {
            const base = o.statusChangedAt || o.createdAt; // хамгаалалт
            if (base && daysBetween(base) > 14) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any)
        );
    }

    setResults(list);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Хайлтын самбар */}
      <div className="md:col-span-1 bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Захиалгын явц шалгах</h2>
        <p className="text-sm text-gray-600 mb-4">
          Та <b>Tracking код</b> эсвэл <b>утасны дугаараа</b> оруулна. Код
          оруулбал тухайн нэг захиалга, утсаар оруулбал <b>бүх захиалга</b>
          <b className="tracking-wide"> жагсаалтаар</b> гарна.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm">Tracking код</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ж: VB-20250823-ABCD"
              className="w-full mt-1 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="text-sm">Утас</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="ж: 99112233"
              className="w-full mt-1 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2"
            />
          </div>
          <button
            onClick={handleFind}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-xl font-medium shadow hover:opacity-90 transition"
          >
            Шалгах
          </button>
          <p className="text-xs text-gray-500">
            * Код оруулсан бол код нь давуу эрхтэй (утас үл тооцно).
          </p>
        </div>
      </div>

      {/* Илэрцийн хэсэг */}
      <div className="md:col-span-2">
        {results === null && (
          <EmptyCard
            title="Ямар нэгэн захиалга харагдахгүй байна"
            subtitle="Дээд талд мэдээллээ оруулаад шалгаарай."
          />
        )}

        {Array.isArray(results) && results.length === 0 && (
          <EmptyCard
            title="Таны оруулсан мэдээллээр олдсонгүй"
            subtitle="Код/утсаа нягталж дахин оролдоно уу."
          />
        )}

        {Array.isArray(results) && results.length > 0 && (
          <>
            <div className="text-sm text-gray-600 mb-2">
              Нийт илэрц: <b>{results.length}</b>
            </div>
            <div className="space-y-4">
              {results.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: any }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Захиалга: {order.trackingCode}</h3>
          <p className="text-sm text-gray-500">
            {order.customerName} • {order.phone} • Бүртгэсэн:{" "}
            {formatDate(order.createdAt)}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass(
            order.status
          )}`}
        >
          {order.status}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <InfoItem label="Барааны мэдээлэл" value={order.itemDesc || "-"} />
        <InfoItem
          label="Дүн"
          value={order.amount ? `${order.amount.toLocaleString()}₮` : "-"}
        />
        <InfoItem label="Төлбөр" value={order.paid ? "Төлсөн" : "Төлөөгүй"} />
        <InfoItem
          label="Таамаг хүргэлтийн өдөр"
          value={order.expectedDate ? formatDate(order.expectedDate) : "-"}
        />
        <InfoItem label="Суваг" value={order.channel || "Онлайн"} />
        <InfoItem label="Тэмдэглэл" value={order.note || "-"} />
      </div>

      <Progress status={order.status} />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium mt-1 break-words">{value}</div>
    </div>
  );
}

function Progress({ status }: { status: string }) {
  const current = Math.max(0, STATUSES.indexOf(status));
  const percent = Math.round(((current + 1) / STATUSES.length) * 100);

  return (
    <div className="mt-8">
      {/* Статусуудын нэр */}
      <div className="flex justify-between text-xs text-gray-600 mb-2">
        {STATUSES.map((s, i) => (
          <div
            key={s}
            className={`flex-1 text-center ${
              i === current ? "font-semibold" : ""
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      {/* Прогресс бар */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Хувь харуулах */}
      <div className="text-center text-xs font-semibold text-gray-700 mt-1">
        {percent}%
      </div>
    </div>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
    </div>
  );
}

/* ----------------- Admin ----------------- */
function AdminView({
  orders,
  setOrders,
  settings,
  setSettings,
}: {
  orders: any[];
  setOrders: (v: any[]) => void;
  settings: any;
  setSettings: (v: any) => void;
}) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");

  if (!authed) {
    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-bold mb-2">Админ нэвтрэх</h2>
        <p className="text-sm text-gray-600 mb-4">
          Эхний PIN: {settings.adminPIN}. Аюулгүй байдлаар удалгүй сольж болно.
        </p>
        <input
          className="w-full border rounded-xl px-3 py-2"
          placeholder="PIN оруулна уу"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && setAuthed(pin === settings.adminPIN)
          }
          type="password"
        />
        <button
          onClick={() => setAuthed(pin === settings.adminPIN)}
          className="mt-3 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-xl font-medium shadow hover:opacity-90 transition"
        >
          Нэвтрэх
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm md:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Шинэ захиалга бүртгэх</h3>
          <NewOrderForm
            onCreate={(o) => setOrders([o, ...orders])}
            prefix={settings.prefix}
            orders={orders}
          />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Тохиргоо</h3>
          <label className="text-sm">Брэнд/Хуудасны нэр</label>
          <input
            className="w-full border rounded-xl px-3 py-2 mt-1"
            value={settings.brand}
            onChange={(e) =>
              setSettings({ ...settings, brand: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-sm">Tracking prefix</label>
              <input
                className="w-full border rounded-xl px-3 py-2 mt-1"
                value={settings.prefix}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    prefix: e.target.value.toUpperCase().slice(0, 4),
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm">PIN</label>
              <input
                className="w-full border rounded-xl px-3 py-2 mt-1"
                value={settings.adminPIN}
                onChange={(e) =>
                  setSettings({ ...settings, adminPIN: e.target.value })
                }
                type="password"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => exportCSV(orders)}
              className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm"
            >
              CSV татах
            </button>
            <ImportCSV onImport={(list) => setOrders(list.concat(orders))} />
            <button
              onClick={() => {
                if (confirm("Бүх локал өгөгдлийг цэвэрлэх үү?")) {
                  localStorage.removeItem(STORAGE_KEY);
                  setOrders([]);
                }
              }}
              className="px-3 py-2 bg-red-50 text-red-700 rounded-xl text-sm"
            >
              Локал цэвэрлэх
            </button>
          </div>
        </div>
      </div>

      <OrdersTable orders={orders} onChange={setOrders} />
    </div>
  );
}

function NewOrderForm({
  onCreate,
  prefix,
  orders, // ← нэмэгдсэн
}: {
  onCreate: (o: any) => void;
  prefix: string;
  orders: any[];
}) {
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    itemDesc: "",
    amount: "",
    paid: false,
    status: STATUSES[0],
    expectedDate: "",
    channel: "Онлайн",
    note: "",
  });

  const trackingCode = useMemo(
    () => makeTrackingCode(prefix || "DG"),
    [prefix]
  );

  // Утасны формат нэгтгэх (тоонуудыг л үлдээнэ)
  const normalize = (s: string) => String(s || "").replace(/\D/g, "");

  // Утас өөрчлөгдөх болгонд — өмнөх захиалга байвал НЭРИЙГ бөглөнө
  function handlePhoneChange(v: string) {
    const norm = normalize(v);

    // хамгийн сүүлийн (шинэ) захиалгыг олно
    const prev = orders
      .filter((o) => normalize(o.phone) === norm)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

    setForm((f) => ({
      ...f,
      phone: v,
      // Хэрвээ өмнө нь бүртгэгдсэн нэр байвал автоматаар бөглөх
      customerName: prev?.customerName ? prev.customerName : f.customerName,
    }));
  }

  function submit() {
    if (!form.phone) {
      alert("Утас заавал!");
      return;
    }
    if (!form.customerName) {
      alert("Нэр заавал!");
      return;
    }

    const order = {
      id: cryptoRandom(),
      trackingCode,
      createdAt: new Date().toISOString(),
      ...form,
      amount: form.amount ? Number(form.amount) : 0,
      statusChangedAt: FINAL_STATUSES.includes(form.status)
        ? new Date().toISOString()
        : null,
    };

    onCreate(order);
    setForm({
      customerName: "",
      phone: "",
      itemDesc: "",
      amount: "",
      paid: false,
      status: STATUSES[0],
      expectedDate: "",
      channel: "Онлайн",
      note: "",
    });
  }

  return (
    <div className="grid md:grid-cols-3 gap-3">
      {/* УТАС – ЭХЭНД */}
      <TextField label="Утас" value={form.phone} onChange={handlePhoneChange} />

      {/* НЭР – хоёрт */}
      <TextField
        label="Харилцагчийн нэр"
        value={form.customerName}
        onChange={(v) => setForm({ ...form, customerName: v })}
      />

      <TextField
        label="Дүн (₮)"
        value={form.amount}
        onChange={(v) => setForm({ ...form, amount: v.replace(/[^\d]/g, "") })}
      />

      <TextField
        className="md:col-span-3"
        label="Барааны мэдээлэл"
        value={form.itemDesc}
        onChange={(v) => setForm({ ...form, itemDesc: v })}
      />

      <SelectField
        label="Статус"
        value={form.status}
        onChange={(v) => setForm({ ...form, status: v })}
        options={STATUSES}
      />

      <TextField
        label="Таамаг өдөр"
        type="date"
        value={form.expectedDate}
        onChange={(v) => setForm({ ...form, expectedDate: v })}
      />

      <TextField
        label="Суваг"
        value={form.channel}
        onChange={(v) => setForm({ ...form, channel: v })}
      />

      <TextField
        className="md:col-span-2"
        label="Тэмдэглэл"
        value={form.note}
        onChange={(v) => setForm({ ...form, note: v })}
      />

      <div className="flex items-center gap-3">
        <input
          id="paid"
          type="checkbox"
          className="w-4 h-4"
          checked={form.paid}
          onChange={(e) => setForm({ ...form, paid: e.target.checked })}
        />
        <label htmlFor="paid" className="text-sm">
          Төлбөр төлсөн
        </label>
      </div>

      <div className="md:col-span-3 flex items-center justify-between mt-2 p-3 bg-gray-50 rounded-xl">
        <div className="text-xs text-gray-600">
          Шинэ Tracking код:{" "}
          <span className="font-mono font-semibold">{trackingCode}</span>
        </div>
        <button
          onClick={submit}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow hover:opacity-90 transition"
        >
          Бүртгэх
        </button>
      </div>
    </div>
  );
}

/* ----------------- Table ----------------- */
function OrdersTable({
  orders,
  onChange,
}: {
  orders: any[];
  onChange: (v: any[]) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders.filter((o) => {
      const okText =
        !t ||
        [o.trackingCode, o.customerName, o.phone, o.itemDesc, o.note]
          .join(" ")
          .toLowerCase()
          .includes(t);
      const okStatus = !status || o.status === status;
      return okText && okStatus;
    });
  }, [orders, q, status]);

  function update(id: string, patch: any) {
    onChange(
      orders.map((o: any) => {
        if (o.id !== id) return o;
        const next = { ...o, ...patch };
        // (Төгсгөлийн статусын тайлбар хадгалалт танай логикоор хэвээр)
        if (typeof patch.status === "string" && patch.status !== o.status) {
          next.statusChangedAt = FINAL_STATUSES.includes(patch.status)
            ? new Date().toISOString()
            : null;
        }
        return next;
      })
    );
  }

  function remove(id: string) {
    if (confirm("Энэ захиалгыг устгах уу?"))
      onChange(orders.filter((o: any) => o.id !== id));
  }

  function goNext(order: any) {
    const i = STATUSES.indexOf(order.status);
    if (i === -1 || i >= STATUSES.length - 1) return;
    update(order.id, { status: STATUSES[i + 1] });
  }

  // —— Засварын туслахууд —— //
  function startEdit(row: any) {
    setEditingId(row.id);
    setDraft({
      customerName: row.customerName || "",
      phone: row.phone || "",
      itemDesc: row.itemDesc || "",
      amount: row.amount ?? 0,
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }
  function saveEdit(id: string) {
    if (!draft) return;
    const name = String(draft.customerName || "").trim();
    const phone = String(draft.phone || "").trim();
    if (!name || !phone) {
      alert("Нэр болон утас хоёрыг заавал бөглөнө үү.");
      return;
    }
    update(id, {
      customerName: name,
      phone,
      itemDesc: String(draft.itemDesc || "").trim(),
      amount: Number(draft.amount) || 0,
    });
    cancelEdit();
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <div className="flex gap-2 flex-1">
          <input
            placeholder="Хайлт: код, нэр, утас, бараа..."
            className="flex-1 border rounded-xl px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Бүх статус</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-500">
          Нийт: {filtered.length} / {orders.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <Th>Код</Th>
              <Th>Нэр</Th>
              <Th>Утас</Th>
              <Th>Бараа</Th>
              <Th>Дүн</Th>
              <Th>Төлбөр</Th>
              <Th>Статус</Th>
              <Th>Таамаг өдөр</Th>
              <Th>Үйлдэл</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o: any) => {
              const isEditing = editingId === o.id;
              return (
                <tr key={o.id} className="border-b last:border-b-0">
                  {/* Код */}
                  <Td className="font-mono">{o.trackingCode}</Td>

                  {/* Нэр */}
                  <Td>
                    {isEditing ? (
                      <input
                        className="border rounded-lg px-2 py-1 w-40"
                        value={draft?.customerName ?? ""}
                        onChange={(e) =>
                          setDraft((d: any) => ({
                            ...d,
                            customerName: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(o.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      o.customerName
                    )}
                  </Td>

                  {/* Утас */}
                  <Td>
                    {isEditing ? (
                      <input
                        className="border rounded-lg px-2 py-1 w-36"
                        value={draft?.phone ?? ""}
                        onChange={(e) =>
                          setDraft((d: any) => ({
                            ...d,
                            phone: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(o.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      o.phone
                    )}
                  </Td>

                  {/* Бараа */}
                  <Td className="max-w-xs">
                    {isEditing ? (
                      <input
                        className="border rounded-lg px-2 py-1 w-full"
                        value={draft?.itemDesc ?? ""}
                        onChange={(e) =>
                          setDraft((d: any) => ({
                            ...d,
                            itemDesc: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(o.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      <span className="truncate block" title={o.itemDesc}>
                        {o.itemDesc}
                      </span>
                    )}
                  </Td>

                  {/* Дүн */}
                  <Td>
                    {isEditing ? (
                      <input
                        className="border rounded-lg px-2 py-1 w-24 text-right"
                        value={draft?.amount ?? 0}
                        onChange={(e) =>
                          setDraft((d: any) => ({
                            ...d,
                            amount: e.target.value.replace(/[^\d]/g, ""),
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(o.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : o.amount ? (
                      `${o.amount.toLocaleString()}₮`
                    ) : (
                      "-"
                    )}
                  </Td>

                  {/* Төлбөр */}
                  <Td>
                    <button
                      className={`px-2 py-1 rounded-lg text-xs ${
                        o.paid ? "bg-green-50 text-green-700" : "bg-gray-100"
                      }`}
                      onClick={() => update(o.id, { paid: !o.paid })}
                      disabled={isEditing}
                    >
                      {o.paid ? "Төлсөн" : "Төлөөгүй"}
                    </button>
                  </Td>

                  {/* Статус */}
                  <Td>
                    <select
                      className="border rounded-lg px-2 py-1"
                      value={o.status}
                      onChange={(e) => update(o.id, { status: e.target.value })}
                      disabled={isEditing}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Td>

                  {/* Таамаг өдөр */}
                  <Td>
                    <input
                      type="date"
                      className="border rounded-lg px-2 py-1"
                      value={o.expectedDate || ""}
                      onChange={(e) =>
                        update(o.id, { expectedDate: e.target.value })
                      }
                      disabled={isEditing}
                    />
                  </Td>

                  {/* Үйлдэл */}
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(o.id)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs"
                          >
                            Хадгалах
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 bg-gray-100 rounded-lg text-xs"
                          >
                            Болих
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(o)}
                            className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs"
                          >
                            Засах
                          </button>

                          <button
                            onClick={() => goNext(o)}
                            disabled={
                              STATUSES.indexOf(o.status) === STATUSES.length - 1
                            }
                            className={
                              "px-2 py-1 rounded-lg text-xs " +
                              (STATUSES.indexOf(o.status) ===
                              STATUSES.length - 1
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-100 text-blue-700 hover:bg-blue-200")
                            }
                            title="Статусыг дараагийн шат руу автоматаар ахиулах"
                          >
                            ↗ Дараагийн шат
                          </button>

                          <button
                            className="px-2 py-1 bg-gray-100 rounded-lg text-xs"
                            onClick={() => copy(o.trackingCode)}
                          >
                            Код
                          </button>
                          <button
                            className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs"
                            onClick={() => remove(o.id)}
                          >
                            Устгах
                          </button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-gray-500 py-6">
                  Илэрц алга
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-semibold text-gray-600">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

/* ----------------- Small Inputs ----------------- */
function TextField({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm">{label}</label>
      <input
        className="w-full border rounded-xl px-3 py-2 mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="text-sm">{label}</label>
      <select
        className="w-full border rounded-xl px-3 py-2 mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ----------------- CSV helpers ----------------- */
function ImportCSV({ onImport }: { onImport: (list: any[]) => void }) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const rows = String(text).split(/\r?\n/).filter(Boolean);
        const [header, ...data] = rows;
        const cols = header.split(",");
        const list = data.map((line) => {
          const cells = line.split(",");
          const obj: any = {};
          cols.forEach((c, i) => (obj[c] = cells[i]));
          obj.amount = obj.amount ? Number(obj.amount) : 0;
          obj.paid = obj.paid === "true" || obj.paid === true;
          obj.id = obj.id || cryptoRandom();
          return obj;
        });
        onImport(list);
      } catch (e) {
        alert("CSV уншихад алдаа гарлаа");
      }
    };
    reader.readAsText(file);
  }

  return (
    <label className="px-3 py-2 bg-gray-100 rounded-xl text-sm cursor-pointer">
      CSV импорт
      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
    </label>
  );
}

function exportCSV(orders: any[]) {
  const headers = [
    "id",
    "trackingCode",
    "customerName",
    "phone",
    "itemDesc",
    "amount",
    "paid",
    "status",
    "expectedDate",
    "channel",
    "note",
    "createdAt",
  ];
  const rows = orders.map((o) => headers.map((h) => o[h] ?? "").join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function copy(text: string) {
  navigator.clipboard?.writeText(text);
  alert("Хуулагдлаа: " + text);
}

function cryptoRandom() {
  if ((window.crypto as any)?.randomUUID) {
    return (window.crypto as any).randomUUID();
  }
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function badgeClass(status: string) {
  const i = STATUSES.indexOf(status);
  if (i <= 0) return "bg-gray-100 text-gray-700";
  if (i === STATUSES.length - 1) return "bg-emerald-100 text-emerald-700";
  return "bg-indigo-100 text-indigo-700";
}

function Logo() {
  return (
    <div
      className="w-9 h-9 rounded-2xl text-white grid place-items-center font-bold"
      style={{
        background: "linear-gradient(135deg, #b87333, #d4a373)", // зэсний градиент
      }}
    >
      ✟
    </div>
  );
}
