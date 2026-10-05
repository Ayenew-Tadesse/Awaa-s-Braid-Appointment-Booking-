import { beforeEach, describe, expect, it } from "vitest";
import { DemoStore, loadWorld, resetDemo } from "./demo-store";
import { at, formatTime } from "../domain/time";
import { freeAt, jobLines, upcomingFor } from "../domain/team";

// localStorage for the tests (the demo keeps the salon there).
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const NOW = new Date(Date.UTC(2026, 9, 6, 11)); // Tue Oct 6, 7:00 AM in the DC area
const clock = () => NOW;
const w0 = () => loadWorld(NOW);
const customer = () => w0().accounts[0].profile_id;
const admin = () => w0().accounts[1].profile_id;
const style = (name: string) => w0().styles.find((s) => s.name === name)!;
const option = (styleName: string, label: string) => w0().options.find((o) => o.style_id === style(styleName).id && o.label === label)!.id;
const tz = "America/New_York";
const HOME = { address: "12 Demo Street NW", city: "Washington, DC", zip: "20001" };

describe("booking in the demo (the database's rules)", () => {
  beforeEach(() => { mem.clear(); resetDemo(); });

  it("books a request with the price and time worked out, which the salon then sees", async () => {
    const store = new DemoStore(customer(), clock);
    const a = await store.book({ styleId: style("Knotless braids").id, optionIds: [option("Knotless braids", "Large"), option("Knotless braids", "Shoulder")],
      stylistId: null, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "  Black hair please  ", address: HOME });
    expect(a.status).toBe("pending");
    expect(a.price).toBe(220);
    expect((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000).toBe(195);
    expect(a.note).toBe("Black hair please");
    const salon = await new DemoStore(admin(), clock).load();
    expect(salon.appointments.some((x) => x.id === a.id)).toBe(true);
  });

  it("refuses a taken time, a time off the grid, too little notice and a missing size", async () => {
    const store = new DemoStore(customer(), clock);
    const cornrows = style("Cornrows").id;
    const first = await store.book({ styleId: cornrows, optionIds: [], stylistId: w0().stylists[0].id, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "", address: HOME });
    const other = new DemoStore(w0().profiles[3].id, clock); // Hana now has 3 upcoming, so another customer tries
    await expect(other.book({ styleId: cornrows, optionIds: [], stylistId: first.stylist_id, startsAt: at("2026-10-16", "09:30", tz).toISOString(), note: "", address: HOME }))
      .rejects.toThrow("no longer free");
    await expect(other.book({ styleId: cornrows, optionIds: [], stylistId: null, startsAt: at("2026-10-16", "10:10", tz).toISOString(), note: "", address: HOME }))
      .rejects.toThrow("offered times");
    await expect(other.book({ styleId: cornrows, optionIds: [], stylistId: null, startsAt: at("2026-10-06", "08:00", tz).toISOString(), note: "", address: HOME }))
      .rejects.toThrow("hours ahead");
    await expect(other.book({ styleId: style("Box braids").id, optionIds: [], stylistId: null, startsAt: at("2026-10-16", "13:00", tz).toISOString(), note: "", address: HOME }))
      .rejects.toThrow("Choose a size.");
  });

  it("\"any stylist\" picks one who is free", async () => {
    const store = new DemoStore(customer(), clock);
    const when = at("2026-10-16", "09:00", tz).toISOString();
    const a = await store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: when, note: "", address: HOME });
    const b = await new DemoStore(w0().profiles[3].id, clock).book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: when, note: "", address: HOME });
    expect(a.stylist_id).not.toBe(b.stylist_id);
  });

  it("allows at most 3 upcoming bookings", async () => {
    const store = new DemoStore(customer(), clock); // Hana already has 2 upcoming
    await store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "", address: HOME });
    await expect(store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: at("2026-10-17", "09:00", tz).toISOString(), note: "", address: HOME }))
      .rejects.toThrow("3 upcoming");
  });

  it("cancels your own request, which frees the time; not someone else's", async () => {
    const store = new DemoStore(customer(), clock);
    const a = await store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: w0().stylists[0].id, startsAt: at("2026-10-16", "11:00", tz).toISOString(), note: "", address: HOME });
    await expect(new DemoStore(w0().profiles[3].id, clock).cancel(a.id)).rejects.toThrow("not found");
    await store.cancel(a.id);
    expect(w0().appointments.find((x) => x.id === a.id)!.cancelled_by).toBe("customer");
    const busy = await store.busyTimes(at("2026-10-16", "00:00", tz).toISOString(), at("2026-10-17", "00:00", tz).toISOString());
    expect(busy.some((b) => b.stylist_id === a.stylist_id && formatTime(b.starts_at, tz) === "11:00 AM")).toBe(false);
  });

  it("a confirmed appointment within 24 hours needs a call", async () => {
    const w = w0();
    const tomorrow = w.appointments.find((a) => a.customer_id === customer() && a.status === "confirmed")!;
    tomorrow.starts_at = new Date(NOW.getTime() + 10 * 3600000).toISOString();
    tomorrow.ends_at = new Date(NOW.getTime() + 14 * 3600000).toISOString();
    localStorage.setItem("awaa_demo_world_v4", JSON.stringify(w));
    await expect(new DemoStore(customer(), clock).cancel(tomorrow.id)).rejects.toThrow("call the salon");
  });

  it("comes to your home: only inside the service area, and the address is saved for next time", async () => {
    const store = new DemoStore(w0().profiles[3].id, clock);
    const book = (address: typeof HOME, time = "09:00") => store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: w0().stylists[0].id, startsAt: at("2026-10-16", time, tz).toISOString(), note: "", address });
    await expect(book({ ...HOME, zip: "22201" })).rejects.toThrow("don't travel");
    await expect(book({ ...HOME, zip: "2000" })).rejects.toThrow("5-digit");
    await expect(book({ ...HOME, address: "" })).rejects.toThrow("address");
    const a = await book({ address: " 5 Demo Road ", city: "Bethesda, MD", zip: "20814" });
    expect([a.visit_address, a.visit_city, a.visit_zip]).toEqual(["5 Demo Road", "Bethesda, MD", "20814"]);
    expect((await store.load()).me.zip).toBe("20814");
    // Hana never sees it.
    const hana = await new DemoStore(customer(), clock).load();
    expect(JSON.stringify(hana)).not.toContain("5 Demo Road");
  });

  it("keeps the travel time free between one visit and the next", async () => {
    const selam = w0().stylists[0].id;
    const one = new DemoStore(w0().profiles[3].id, clock), two = new DemoStore(w0().profiles[4].id, clock);
    const book = (s: DemoStore, time: string) => s.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: selam, startsAt: at("2026-10-16", time, tz).toISOString(), note: "", address: HOME });
    await book(one, "09:00"); // until 10:30, then an hour to travel
    await expect(book(two, "11:00")).rejects.toThrow("no longer free");
    await expect(book(two, "11:30")).resolves.toBeTruthy();
  });

  it("busy times carry no one's name or details", async () => {
    const busy = await new DemoStore(customer(), clock).busyTimes(NOW.toISOString(), new Date(NOW.getTime() + 14 * 86400000).toISOString());
    expect(busy.length).toBeGreaterThan(0);
    expect(busy.every((b) => Object.keys(b).sort().join() === "ends_at,starts_at,stylist_id")).toBe(true);
  });
});

describe("the salon's tools in the demo (admins only)", () => {
  beforeEach(() => { mem.clear(); resetDemo(); });
  const req = () => w0().appointments.find((a) => a.status === "pending" && Date.parse(a.starts_at) > NOW.getTime())!;

  it("customers can't use them", async () => {
    const c = new DemoStore(customer(), clock);
    await expect(c.setStatus(req().id, "confirmed")).rejects.toThrow("permission");
    await expect(c.saveStyle({ ...style("Cornrows"), price: 1 }, [])).rejects.toThrow("permission");
    await expect(c.addTimeOff({ stylist_id: w0().stylists[0].id, starts_at: NOW.toISOString(), ends_at: new Date(NOW.getTime() + 3600000).toISOString(), reason: null })).rejects.toThrow("permission");
  });

  it("remove a stylist only once their upcoming jobs have moved; history keeps them", async () => {
    const s = new DemoStore(admin(), clock);
    const hiwot = w0().stylists[2];
    await expect(new DemoStore(customer(), clock).removeStylist(hiwot.id)).rejects.toThrow("permission");
    await expect(s.removeStylist(hiwot.id)).rejects.toThrow("Move their upcoming appointments");
    // Move each of Hiwot's jobs to whoever is free at the same time (as "Move all" does).
    for (const a of upcomingFor(hiwot.id, w0().appointments, NOW)) {
      const to = w0().stylists.find((x) => x.id !== hiwot.id && freeAt(a, x.id, w0(), NOW));
      if (to) await s.reschedule(a.id, a.starts_at, to.id); else await s.setStatus(a.id, "cancelled");
    }
    await s.removeStylist(hiwot.id);
    const w = w0();
    expect(w.stylists.find((x) => x.id === hiwot.id)!.removed_at).toBeTruthy();
    expect(w.hours.some((h) => h.stylist_id === hiwot.id)).toBe(false);
    expect(w.appointments.some((a) => a.stylist_id === hiwot.id)).toBe(true); // past ones keep her
    await expect(s.saveStylist({ ...w.stylists.find((x) => x.id === hiwot.id)!, active: true }, [])).rejects.toThrow("was removed");
    // Customers can't book her; one she braided before still sees her name (Ruth never had her).
    const store = new DemoStore(customer(), clock);
    expect((await store.load()).stylists.some((x) => x.id === hiwot.id)).toBe(true); // Hana's past cornrows
    expect((await new DemoStore(w.profiles[3].id, clock).load()).stylists.some((x) => x.id === hiwot.id)).toBe(false);
    await expect(store.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: hiwot.id, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "", address: HOME }))
      .rejects.toThrow("no longer free");
  });

  it("stylist logins: the salon links one; the stylist sees only their own jobs and marks them", async () => {
    const s = new DemoStore(admin(), clock);
    const w = w0();
    const selam = w.accounts[2].profile_id, hiwot = w.stylists[2];
    // Selam (linked in the demo) sees her jobs, their customers, and nobody else.
    const mine = await new DemoStore(selam, clock).load();
    const selamId = w.stylists[0].id;
    expect(mine.appointments.length).toBeGreaterThan(0);
    expect(mine.appointments.every((a) => a.stylist_id === selamId)).toBe(true);
    expect(mine.people.every((p) => p.id === selam || mine.appointments.some((a) => a.customer_id === p.id))).toBe(true);
    expect(mine.timeOff.every((x) => x.stylist_id === selamId)).toBe(true);
    // She marks a started job; not a future one, not another stylist's.
    const future = mine.appointments.find((a) => a.status === "confirmed" && Date.parse(a.starts_at) > NOW.getTime())!;
    await expect(new DemoStore(selam, clock).markJob(future.id, "completed")).rejects.toThrow("once it has started");
    const other = w.appointments.find((a) => a.stylist_id !== selamId)!;
    await expect(new DemoStore(selam, clock).markJob(other.id, "completed")).rejects.toThrow("not found");
    await expect(new DemoStore(selam, clock).setStatus(future.id, "cancelled")).rejects.toThrow("permission");
    // Linking Hiwot's account: only the salon, only an existing email.
    await expect(new DemoStore(customer(), clock).linkLogin(hiwot.id, "hiwot@example.com")).rejects.toThrow("permission");
    await expect(s.linkLogin(hiwot.id, "nobody@example.com")).rejects.toThrow("sign up first");
    await expect(s.linkLogin(hiwot.id, "admin@example.com")).rejects.toThrow("admin account");
    await expect(s.linkLogin(hiwot.id, "stylist@example.com")).rejects.toThrow("another stylist");
    await s.linkLogin(hiwot.id, " HIWOT@example.com ");
    const login = w0().stylists[2].profile_id!;
    expect(w0().profiles.find((p) => p.id === login)!.role).toBe("stylist");
    // Confirming one of her requests tells her.
    const req = w0().appointments.find((a) => a.stylist_id === hiwot.id && a.status === "pending" && Date.parse(a.starts_at) > NOW.getTime())!;
    await s.setStatus(req.id, "confirmed");
    expect((await new DemoStore(login, clock).load()).notifications.some((n) => n.kind === "job_assigned")).toBe(true);
    await s.unlinkLogin(hiwot.id);
    expect(w0().profiles.find((p) => p.id === login)!.role).toBe("customer");
    expect((await new DemoStore(login, clock).load()).appointments).toEqual([]);
  });

  it("someone waiting to join: only the salon adds them to the team (or declines)", async () => {
    const s = new DemoStore(admin(), clock);
    const hiwotLogin = w0().profiles.find((p) => p.wants_stylist)!;
    expect((await s.load()).people.some((p) => p.id === hiwotLogin.id && p.wants_stylist)).toBe(true);
    await expect(new DemoStore(customer(), clock).linkProfile(w0().stylists[2].id, hiwotLogin.id)).rejects.toThrow("permission");
    await expect(s.linkProfile(w0().stylists[2].id, admin())).rejects.toThrow("admin account");
    await s.linkProfile(w0().stylists[2].id, hiwotLogin.id);
    const p = w0().profiles.find((x) => x.id === hiwotLogin.id)!;
    expect([p.role, p.wants_stylist]).toEqual(["stylist", false]);
    expect((await new DemoStore(hiwotLogin.id, clock).load()).appointments.every((a) => a.stylist_id === w0().stylists[2].id)).toBe(true);
  });

  it("a day's jobs read as a message for the stylist", () => {
    const w = w0();
    const a = upcomingFor(w.stylists[0].id, w.appointments, NOW)[0];
    const [line] = jobLines([a], w.profiles, (iso) => formatTime(iso, tz));
    const c = w.profiles.find((p) => p.id === a.customer_id)!;
    expect(line).toContain(a.style_name);
    expect(line).toContain(`${c.full_name} · ${c.phone}`);
    expect(line).toContain(a.visit_address!);
    expect(line).toContain("google.com/maps");
  });

  it("confirm, decline (says the salon cancelled), and done or missed only once started", async () => {
    const s = new DemoStore(admin(), clock);
    const r = req();
    await s.setStatus(r.id, "confirmed");
    expect(w0().appointments.find((a) => a.id === r.id)!.status).toBe("confirmed");
    await expect(s.setStatus(r.id, "completed")).rejects.toThrow("once it has started");
    await s.setStatus(r.id, "cancelled");
    expect(w0().appointments.find((a) => a.id === r.id)!.cancelled_by).toBe("salon");
  });

  it("move an appointment to a free time (same length), never onto a busy stylist", async () => {
    const s = new DemoStore(admin(), clock);
    const r = req();
    const length = Date.parse(r.ends_at) - Date.parse(r.starts_at);
    const to = at("2026-10-16", "13:00", tz).toISOString();
    await s.reschedule(r.id, to, w0().stylists[0].id);
    const moved = w0().appointments.find((a) => a.id === r.id)!;
    expect([moved.starts_at, Date.parse(moved.ends_at) - Date.parse(moved.starts_at), moved.stylist_id]).toEqual([to, length, w0().stylists[0].id]);
    const other = w0().appointments.find((a) => a.id !== r.id && a.status === "pending" && Date.parse(a.starts_at) > NOW.getTime())!;
    await expect(s.reschedule(other.id, to, w0().stylists[0].id)).rejects.toThrow("no longer free");
  });

  it("add a style with options, which customers then see and can book", async () => {
    const s = new DemoStore(admin(), clock);
    const id = await s.saveStyle({ name: "Goddess locs", description: "", category: "locs", image_url: null, duration_minutes: 300, price: 260, active: true, sort: 8 },
      [{ kind: "length", label: "Shoulder", extra_minutes: 0, extra_price: 0 }, { kind: "length", label: "Waist", extra_minutes: 60, extra_price: 50 }]);
    const seen = await new DemoStore(customer(), clock).load();
    expect(seen.styles.some((x) => x.id === id)).toBe(true);
    expect(seen.options.filter((o) => o.style_id === id).map((o) => o.label)).toEqual(["Shoulder", "Waist"]);
    await expect(s.saveStyle({ ...style("Cornrows"), duration_minutes: 5 }, [])).rejects.toThrow("15 minutes");
  });

  it("a hidden style disappears for customers but stays for the salon", async () => {
    const s = new DemoStore(admin(), clock);
    const box = style("Box braids");
    await s.saveStyle({ ...box, active: false }, w0().options.filter((o) => o.style_id === box.id));
    expect((await new DemoStore(customer(), clock).load()).styles.some((x) => x.id === box.id)).toBe(false);
    expect((await s.load()).styles.some((x) => x.id === box.id)).toBe(true);
  });

  it("change a stylist's week; overlapping blocks are refused", async () => {
    const s = new DemoStore(admin(), clock);
    const meron = w0().stylists[1];
    await s.saveStylist(meron, [{ weekday: 3, starts: "10:00", ends: "16:00" }]);
    expect(w0().hours.filter((h) => h.stylist_id === meron.id).map((h) => `${h.weekday} ${h.starts}-${h.ends}`)).toEqual(["3 10:00-16:00"]);
    await expect(s.saveStylist(meron, [{ weekday: 3, starts: "10:00", ends: "16:00" }, { weekday: 3, starts: "15:00", ends: "18:00" }])).rejects.toThrow("overlap");
  });

  it("time off blocks booking, and removing it frees the time again", async () => {
    const s = new DemoStore(admin(), clock);
    const selam = w0().stylists[0].id;
    await s.addTimeOff({ stylist_id: selam, starts_at: at("2026-10-16", "09:00", tz).toISOString(), ends_at: at("2026-10-16", "19:00", tz).toISOString(), reason: "Dentist" });
    const c = new DemoStore(w0().profiles[3].id, clock);
    await expect(c.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: selam, startsAt: at("2026-10-16", "10:00", tz).toISOString(), note: "", address: HOME })).rejects.toThrow("no longer free");
    await s.removeTimeOff(w0().timeOff.find((t) => t.reason === "Dentist")!.id);
    await c.book({ styleId: style("Cornrows").id, optionIds: [], stylistId: selam, startsAt: at("2026-10-16", "10:00", tz).toISOString(), note: "", address: HOME });
  });
});

describe("notifications in the demo (the database's trigger)", () => {
  beforeEach(() => { mem.clear(); resetDemo(); });
  const latest = async (who: string) => (await new DemoStore(who, clock).load()).notifications[0];

  it("a new request tells the salon, with who booked", async () => {
    await new DemoStore(customer(), clock).book({ styleId: style("Cornrows").id, optionIds: [], stylistId: null, startsAt: at("2026-10-16", "09:00", tz).toISOString(), note: "", address: HOME });
    expect(await latest(admin())).toMatchObject({ kind: "booked", read_at: null, data: { customer: "Hana Bekele", style: "Cornrows" } });
  });

  it("confirming, moving and declining tell the customer; their cancelling tells the salon", async () => {
    const s = new DemoStore(admin(), clock);
    const r = w0().appointments.find((a) => a.customer_id === customer() && a.status === "pending")!;
    await s.setStatus(r.id, "confirmed");
    expect((await latest(customer())).kind).toBe("confirmed");
    await s.reschedule(r.id, at("2026-10-16", "13:00", tz).toISOString(), w0().stylists[0].id);
    expect(await latest(customer())).toMatchObject({ kind: "moved", data: { starts_at: at("2026-10-16", "13:00", tz).toISOString(), stylist: "Selam" } });
    await new DemoStore(customer(), clock).cancel(r.id);
    expect((await latest(admin())).kind).toBe("cancelled_by_customer");
    const other = w0().appointments.find((a) => a.status === "pending" && a.customer_id !== customer() && Date.parse(a.starts_at) > NOW.getTime())!;
    await s.setStatus(other.id, "cancelled");
    expect((await new DemoStore(other.customer_id, clock).load()).notifications[0].kind).toBe("declined");
  });

  it("each person sees and marks only their own", async () => {
    const mine = (await new DemoStore(customer(), clock).load()).notifications;
    expect(mine.every((n) => n.user_id === customer())).toBe(true);
    const theirs = (await new DemoStore(admin(), clock).load()).notifications.map((n) => n.id);
    await new DemoStore(customer(), clock).markRead(theirs);
    expect((await new DemoStore(admin(), clock).load()).notifications.filter((n) => !n.read_at).length).toBeGreaterThan(0);
    await new DemoStore(customer(), clock).markRead(mine.map((n) => n.id));
    expect((await new DemoStore(customer(), clock).load()).notifications.every((n) => n.read_at)).toBe(true);
  });
});
