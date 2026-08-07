"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { addDeliveryDriver, addDeliveryZone, addDeliveryZonesBulk, deleteDeliveryDriver, deleteDeliveryZone, getSellerDeliverySettings, saveSellerDeliverySettings, updateDeliveryDriver, updateDeliveryZone } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import { ABIDJAN_DELIVERY_AREAS } from "../../lib/local-commerce";

const defaultSettings = {
  delivery_enabled: true,
  pickup_enabled: true,
  fixed_delivery_fee: 1000,
  delivery_payment_timing: "AT_RECEPTION",
  auto_share_to_driver: false,
};

const abidjanZoneSuggestions = ABIDJAN_DELIVERY_AREAS;

export default function DeliverySettingsPage() {
  const activeSeller = useActiveSeller();
  const [seller, setSeller] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [drivers, setDrivers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: "", phone_number: "", zone: "" });
  const [newZone, setNewZone] = useState({ name: "", fee: "" });
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingZone, setEditingZone] = useState(null);
  const nextAction = getDeliveryNextAction({
    zones,
    drivers,
    settings,
    onAddZone: () => openZoneModal(),
    onAddDriver: () => openDriverModal(),
    onSave: saveSettings,
  });

  const fetchData = useCallback(async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const token = await getSellerAccessToken();
      const { seller: sellerData, drivers: driverData, zones: zoneData } = await getSellerDeliverySettings(activeSeller.slug, token);
      setSeller(sellerData);
      setSettings({
        delivery_enabled: sellerData.delivery_enabled ?? true,
        pickup_enabled: sellerData.pickup_enabled ?? true,
        fixed_delivery_fee: sellerData.fixed_delivery_fee ?? 1000,
        delivery_payment_timing: sellerData.delivery_payment_timing ?? "AT_RECEPTION",
        auto_share_to_driver: sellerData.auto_share_to_driver ?? false,
      });

      setDrivers(driverData || []);
      setZones(zoneData || []);
    } catch (err) {
      console.error("Error fetching delivery settings:", err);
      setError(friendlyError(err, "Livraison non chargee. Verifie la connexion puis actualise."));
    } finally {
      setLoading(false);
    }
  }, [activeSeller.slug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchData]);

  async function saveSettings() {
    if (!seller) return;

    try {
      setSaving(true);
      setError("");
      const token = await getSellerAccessToken();
      await saveSellerDeliverySettings(seller.id, settings, token);
      alert("Parametres enregistres.");
      await fetchData();
    } catch (err) {
      setError(friendlyError(err, "Reglages non sauvegardes. Garde la page ouverte puis relance l'enregistrement."));
    } finally {
      setSaving(false);
    }
  }

  function openDriverModal(driver = null) {
    setEditingDriver(driver);
    setNewDriver(driver ? {
      name: driver.name || "",
      phone_number: driver.phone_number || "",
      zone: driver.zone || "",
    } : { name: "", phone_number: "", zone: "" });
    setShowAddDriver(true);
  }

  function closeDriverModal() {
    setShowAddDriver(false);
    setEditingDriver(null);
    setNewDriver({ name: "", phone_number: "", zone: "" });
  }

  async function handleSaveDriver() {
    if (!seller) return;

    try {
      setSaving(true);
      const token = await getSellerAccessToken();
      const driver = editingDriver
        ? await updateDeliveryDriver(editingDriver.id, newDriver, token)
        : await addDeliveryDriver(seller.id, newDriver, token);

      setDrivers((current) => (
        editingDriver
          ? current.map((item) => (item.id === driver.id ? driver : item))
          : [driver, ...current]
      ));
      closeDriverModal();
    } catch (err) {
      setError(friendlyError(err, "Livreur non enregistre. Verifie le nom et le numero WhatsApp."));
    } finally {
      setSaving(false);
    }
  }

  function openZoneModal(zone = null) {
    setEditingZone(zone);
    setNewZone(zone ? { name: zone.name || "", fee: String(zone.fee ?? "") } : { name: "", fee: "" });
    setShowAddZone(true);
  }

  function openSuggestedZone(name) {
    setEditingZone(null);
    setNewZone({ name, fee: "" });
    setShowAddZone(true);
  }

  function closeZoneModal() {
    setShowAddZone(false);
    setEditingZone(null);
    setNewZone({ name: "", fee: "" });
  }

  async function handleSaveZone() {
    if (!seller) return;

    try {
      setSaving(true);
      const token = await getSellerAccessToken();
      const zone = editingZone
        ? await updateDeliveryZone(editingZone.id, newZone, token)
        : await addDeliveryZone(seller.id, newZone, token);

      setZones((current) => {
        const next = editingZone
          ? current.map((item) => (item.id === zone.id ? zone : item))
          : [...current, zone];

        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      closeZoneModal();
    } catch (err) {
      setError(friendlyError(err, "Zone non enregistree. Verifie le nom du quartier et le tarif."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAbidjanZones() {
    if (!seller) return;

    try {
      setSaving(true);
      setError("");
      const token = await getSellerAccessToken();
      const fee = Number(settings.fixed_delivery_fee || 1000);
      const inserted = await addDeliveryZonesBulk(
        seller.id,
        abidjanZoneSuggestions.map((name) => ({ name, fee })),
        token,
      );

      if (inserted.length === 0) {
        setError("Les communes Abidjan sont deja dans ta liste. Tu peux modifier les frais une par une.");
        return;
      }

      setZones((current) => [...current, ...inserted].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(friendlyError(err, "Communes non ajoutees. Reessaie avec une bonne connexion."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteZone(zoneId) {
    try {
      const token = await getSellerAccessToken();
      await deleteDeliveryZone(zoneId, token);
      setZones((current) => current.filter((zone) => zone.id !== zoneId));
    } catch (err) {
      setError(friendlyError(err, "Zone gardee pour le moment."));
    }
  }

  async function handleDeleteDriver(driverId) {
    try {
      const token = await getSellerAccessToken();
      await deleteDeliveryDriver(driverId, token);
      setDrivers((current) => current.filter((driver) => driver.id !== driverId));
    } catch (err) {
      setError(friendlyError(err, "Livreur garde pour le moment."));
    }
  }

  return (
    <div className="app-shell">
      <header className="mobile-top">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[var(--primary)]">Livraison</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Reglages livraison</h1>
            <p className="mt-1 text-base text-[var(--text-dim)]">Choisis retrait, livraison, frais par zone et livreurs WhatsApp.</p>
          </div>
          <button onClick={saveSettings} disabled={saving || !seller} className="app-icon-button bg-[var(--primary-bright)] text-white disabled:bg-[var(--surface-mid)]" aria-label="Enregistrer">
            <Save size={19} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
          <p className="mt-4 font-extrabold text-zinc-400">Chargement...</p>
        </div>
      ) : (
        <main className="mt-8 space-y-5 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <DeliveryNextActionCard action={nextAction} saving={saving} />

          <section className="grid grid-cols-3 gap-2">
            <DeliveryStat icon={<MapPin size={17} />} label="Zones" value={zones.length} tone="primary" />
            <DeliveryStat icon={<Truck size={17} />} label="Livreurs" value={drivers.length} tone="info" />
            <DeliveryStat icon={<CircleDollarSign size={17} />} label="Frais" value={`${Number(settings.fixed_delivery_fee || 0).toLocaleString("fr-FR")} F`} tone="accent" />
          </section>

          <div className="grid gap-6 md:grid-cols-[0.95fr_1.05fr] md:items-start">
          <section className="space-y-5">
          <div>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
              <Truck className="text-[var(--primary)]" size={21} />
              Modes de livraison
            </h2>
            <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-white p-2 shadow-[var(--shadow-sm)]">
              <ToggleRow
                title="Livraison a domicile"
                text="Le client renseigne son quartier et son adresse."
                active={settings.delivery_enabled}
                onClick={() => setSettings({ ...settings, delivery_enabled: !settings.delivery_enabled })}
              />
              <ToggleRow
                title="Retrait sur place"
                text="Le client peut choisir de venir recuperer."
                active={settings.pickup_enabled}
                onClick={() => setSettings({ ...settings, pickup_enabled: !settings.pickup_enabled })}
              />
              <ToggleRow
                title="Partage livreur auto"
                text="Quand tu marques une commande prete, Tikchop l'envoie au livreur de la zone."
                active={settings.auto_share_to_driver}
                onClick={() => setSettings({ ...settings, auto_share_to_driver: !settings.auto_share_to_driver })}
              />
            </div>
          </div>

          <div>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
              <CheckCircle2 className="text-[var(--primary)]" size={21} />
              Frais & Paiement
            </h2>
            <div className="rounded-[18px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
              <label className="block">
                <span className="quiet-label mb-2 block">Frais fixes si aucune zone ne correspond</span>
                <input type="number" value={settings.fixed_delivery_fee} onChange={(event) => setSettings({ ...settings, fixed_delivery_fee: event.target.value })} className="mobile-input" placeholder="1000" />
              </label>

              <div className="mt-5 space-y-3">
                <PaymentChoice
                  title="Apres reception"
                  text="Le client paie la livraison au livreur."
                  active={settings.delivery_payment_timing === "AT_RECEPTION"}
                  onClick={() => setSettings({ ...settings, delivery_payment_timing: "AT_RECEPTION" })}
                />
                <PaymentChoice
                  title="Inclus au paiement"
                  text="Le client paie produit + livraison."
                  active={settings.delivery_payment_timing === "INCLUDED"}
                  onClick={() => setSettings({ ...settings, delivery_payment_timing: "INCLUDED" })}
                />
                <PaymentChoice
                  title="Livraison offerte"
                  text="La boutique prend en charge."
                  active={settings.delivery_payment_timing === "OFFERED"}
                  onClick={() => setSettings({ ...settings, delivery_payment_timing: "OFFERED" })}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-[var(--surface-soft)] p-4">
                <p className="quiet-label text-[var(--primary)]">Options visibles client</p>
                <p className="mt-2 text-sm font-bold leading-5 text-[var(--text-main)]">
                  Wave, Orange Money, MTN Money, paiement a la livraison et paiement en ligne.
                </p>
              </div>
            </div>
          </div>
          </section>

          <section>
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
                  <MapPin className="text-[var(--primary)]" size={21} />
                  Gestion des zones
                </h2>
                <div className="flex gap-2">
                  <button onClick={handleAddAbidjanZones} disabled={saving} className="hidden min-h-[40px] items-center gap-1 rounded-full bg-[var(--surface-soft)] px-3 text-sm font-extrabold text-[var(--primary)] disabled:opacity-60 min-[390px]:flex">
                    Abidjan
                  </button>
                  <button onClick={() => openZoneModal()} className="flex min-h-[40px] items-center gap-1 rounded-full bg-[var(--text-main)] px-3 text-sm font-extrabold text-white">
                    <Plus size={16} strokeWidth={3} />
                    Ajouter
                  </button>
                </div>
              </div>
              <button onClick={handleAddAbidjanZones} disabled={saving} className="mb-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[var(--surface-soft)] px-4 text-sm font-extrabold text-[var(--primary)] disabled:opacity-60 min-[390px]:hidden">
                Ajouter les communes d&apos;Abidjan
              </button>

              {zones.length === 0 ? (
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-6 text-center shadow-[var(--shadow-sm)]">
                  <MapPin className="mx-auto text-zinc-300" size={30} />
                  <p className="mt-3 font-extrabold text-zinc-950">Frais fixes actifs</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-400">Ajoute toutes les communes d&apos;Abidjan en un geste, puis ajuste les frais selon ton livreur.</p>
                  <button onClick={handleAddAbidjanZones} disabled={saving} className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--text-main)] text-sm font-extrabold text-white disabled:bg-zinc-300">
                    {saving ? "Ajout..." : "Ajouter Abidjan"}
                  </button>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {abidjanZoneSuggestions.slice(0, 12).map((name) => (
                      <button key={name} onClick={() => openSuggestedZone(name)} className="min-h-[38px] rounded-full bg-[var(--surface-soft)] px-3 text-sm font-extrabold text-[var(--primary)]">
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {zones.map((zone) => (
                    <div key={zone.id} className="flex items-center justify-between rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
                          <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--text-main)]">{zone.name}</p>
                          <p className="truncate text-sm text-[var(--primary)]">{Number(zone.fee || 0).toLocaleString("fr-FR")} F</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => openZoneModal(zone)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500" aria-label={`Modifier ${zone.name}`}>
                          <Pencil size={17} />
                        </button>
                        <button onClick={() => handleDeleteZone(zone.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300" aria-label={`Supprimer ${zone.name}`}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
                <Truck className="text-[var(--primary)]" size={21} />
                Livreurs
              </h2>
                <button onClick={() => openDriverModal()} className="flex min-h-[40px] items-center gap-1 rounded-full bg-[var(--text-main)] px-3 text-sm font-extrabold text-white">
                <Plus size={16} strokeWidth={3} />
                Ajouter
              </button>
            </div>

            {drivers.length === 0 ? (
              <div className="rounded-[18px] border border-[var(--line)] bg-white p-7 text-center shadow-[var(--shadow-sm)]">
                <Truck className="mx-auto text-zinc-300" size={34} />
                <p className="mt-3 font-extrabold text-zinc-950">Aucun livreur</p>
                <p className="mt-1 text-sm font-semibold text-zinc-400">Ajoute les numeros WhatsApp de ta panoplie.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {drivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--info-soft)] text-[var(--info)]">
                        <User size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--text-main)]">{driver.name}</p>
                        <p className="truncate text-sm text-[var(--text-dim)]">{driver.phone_number} / {driver.zone || "Toutes zones"}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => openDriverModal(driver)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500" aria-label={`Modifier ${driver.name}`}>
                        <Pencil size={17} />
                      </button>
                      <button onClick={() => handleDeleteDriver(driver.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300" aria-label={`Supprimer ${driver.name}`}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          </div>
        </main>
      )}

      {showAddDriver && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
          <div className="mx-auto w-full max-w-[420px] rounded-[22px] bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-zinc-950">{editingDriver ? "Modifier le livreur" : "Nouveau livreur"}</h2>
              <button onClick={closeDriverModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input className="mobile-input bg-zinc-50" placeholder="Nom du livreur" value={newDriver.name} onChange={(event) => setNewDriver({ ...newDriver, name: event.target.value })} />
              <input className="mobile-input bg-zinc-50" placeholder="WhatsApp" value={newDriver.phone_number} onChange={(event) => setNewDriver({ ...newDriver, phone_number: event.target.value })} />
              <input className="mobile-input bg-zinc-50" placeholder="Zone optionnelle" value={newDriver.zone} onChange={(event) => setNewDriver({ ...newDriver, zone: event.target.value })} />
            </div>
            <button onClick={handleSaveDriver} disabled={saving} className="mt-5 min-h-[58px] w-full rounded-2xl bg-zinc-950 text-base font-extrabold text-white disabled:bg-zinc-300">
              {editingDriver ? "Mettre a jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {showAddZone && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
          <div className="mx-auto w-full max-w-[420px] rounded-[22px] bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-zinc-950">{editingZone ? "Modifier la zone" : "Nouvelle zone"}</h2>
              <button onClick={closeZoneModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input className="mobile-input bg-zinc-50" placeholder="Ex: Angre, Riviera 2, Koumassi..." value={newZone.name} onChange={(event) => setNewZone({ ...newZone, name: event.target.value })} />
              <input className="mobile-input bg-zinc-50" type="number" placeholder="Frais livraison" value={newZone.fee} onChange={(event) => setNewZone({ ...newZone, fee: event.target.value })} />
            </div>
            <button onClick={handleSaveZone} disabled={saving} className="mt-5 min-h-[58px] w-full rounded-2xl bg-zinc-950 text-base font-extrabold text-white disabled:bg-zinc-300">
              {editingZone ? "Mettre a jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getDeliveryNextAction({ zones, drivers, settings, onAddZone, onAddDriver, onSave }) {
  if (zones.length === 0 && settings.delivery_enabled) {
    return {
      step: "1",
      title: "Ajoute tes zones",
      body: "Le vendeur choisit lui-meme les quartiers, communes ou sous-quartiers qu'il livre.",
      label: "Ajouter une zone",
      icon: <MapPin size={20} />,
      onClick: onAddZone,
    };
  }

  if (drivers.length === 0 && settings.delivery_enabled) {
    return {
      step: "2",
      title: "Ajoute un livreur",
      body: "Son numero WhatsApp permettra de partager une commande prete en un geste.",
      label: "Ajouter un livreur",
      icon: <Truck size={20} />,
      onClick: onAddDriver,
    };
  }

  return {
    step: "OK",
    title: "Livraison prete",
    body: "Les clients pourront choisir retrait ou livraison selon tes reglages.",
    label: "Enregistrer les reglages",
    icon: <Save size={20} />,
    onClick: onSave,
    strong: true,
  };
}

function DeliveryNextActionCard({ action, saving }) {
  return (
    <section className={`rounded-[20px] border p-4 shadow-[var(--shadow-sm)] ${action.strong ? "border-[var(--text-main)] bg-[var(--text-main)] text-white" : "border-[var(--line)] bg-white text-[var(--text-main)]"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${action.strong ? "bg-white text-[var(--text-main)]" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>
          {action.step}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`quiet-label ${action.strong ? "text-white/55" : "text-[var(--primary)]"}`}>Action suivante</p>
          <h2 className="mt-1 font-display text-xl font-bold leading-7">{action.title}</h2>
          <p className={`mt-1 text-sm leading-5 ${action.strong ? "text-white/68" : "text-[var(--text-dim)]"}`}>{action.body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={action.onClick}
        disabled={saving}
        className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold active:scale-[0.99] disabled:opacity-70 ${
          action.strong ? "bg-[var(--primary-bright)] text-zinc-950" : "bg-[var(--text-main)] text-white"
        }`}
      >
        {saving ? "Enregistrement..." : action.icon}
        {saving ? "" : action.label}
        {!saving && <ArrowRight size={18} />}
      </button>
    </section>
  );
}

function DeliveryStat({ icon, label, value, tone }) {
  const toneClass = {
    primary: "bg-[var(--surface-soft)] text-[var(--primary)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  }[tone];

  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white p-3 shadow-[var(--shadow-sm)]">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
        {icon}
      </span>
      <p className="mt-3 font-display text-lg font-bold leading-none text-[var(--text-main)]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[var(--text-dim)]">{label}</p>
    </div>
  );
}

function ToggleRow({ title, text, active, onClick }) {
  return (
    <button onClick={onClick} className="flex min-h-[82px] w-full items-center justify-between gap-4 border-b border-[var(--surface-mid)] p-4 text-left last:border-b-0">
      <div>
        <p className="font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[var(--text-dim)]">{text}</p>
      </div>
      <div className={`h-6 w-12 shrink-0 rounded-full p-0.5 transition ${active ? "bg-[var(--primary-bright)]" : "bg-[var(--surface-mid)]"}`}>
        <div className={`h-5 w-5 rounded-full bg-white transition ${active ? "translate-x-6" : ""}`} />
      </div>
    </button>
  );
}

function PaymentChoice({ title, text, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex min-h-[72px] w-full items-center justify-between gap-4 rounded-lg border p-3 text-left ${active ? "border-[var(--primary-bright)] bg-[var(--surface-soft)]" : "border-[var(--outline)]/45 bg-white"}`}>
      <div>
        <p className="font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-xs leading-4 text-[var(--text-dim)]">{text}</p>
      </div>
      {active && <CheckCircle2 className="text-[var(--primary)]" size={20} />}
    </button>
  );
}
