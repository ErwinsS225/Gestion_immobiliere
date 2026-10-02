"use client";

import { useState } from "react";
import { MessageCircle, PlusCircle, Receipt } from "lucide-react";
import { PaymentForm, type RentCallForPayment } from "@/components/payment-form";
import { normaliserWhatsapp } from "@/lib/tenants/whatsapp";
import { lienRelancePour, formatPeriode } from "@/lib/leases/reminder";
import { formatFCFA } from "@/lib/lease-utils";

const STATUT_STYLE: Record<string, string> = {
  paid: "condition-success",
  pending: "condition-neutral",
  partial: "condition-warning",
  overdue: "condition-danger",
};

const STATUT_LABEL: Record<string, string> = {
  paid: "Payée",
  pending: "En attente",
  partial: "Partielle",
  overdue: "En retard",
};

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Identité du locataire et de l'agence, nécessaire au message de relance. */
export interface RelanceContext {
  nomLocataire: string | null;
  whatsappLocataire: string | null;
  nomAgence: string | null;
}

/**
 * Suivi des échéances d'un bail, avec l'enregistrement d'un règlement.
 *
 * Le composant est côté client parce que l'ouverture de la modale relève de
 * l'état local. Le statut affiché n'est jamais calculé ici : il vient de la
 * base, où le trigger l'a recalculé après chaque règlement confirmé. Le
 * formulaire ne fait qu'afficher ce que la source de vérité dit.
 */
export function RentCallTracker({
  rentCalls,
  relance,
}: {
  rentCalls: RentCallForPayment[];
  /** Locataire et agence, nécessaires pour composer le message. */
  relance?: RelanceContext;
}) {
  const [echeanceOuverte, setEcheanceOuverte] = useState<string | null>(null);

  const attendu = rentCalls.reduce((somme, ligne) => somme + Number(ligne.total_amount), 0);
  const encaisse = rentCalls.reduce((somme, ligne) => somme + Number(ligne.amount_paid), 0);
  const enRetard = rentCalls.filter((ligne) => ligne.status === "overdue").length;

  return (
    <section className="properties-panel property-overview-panel">
      <div className="panel-header">
        <div>
          <p className="dashboard-eyebrow">Suivi</p>
          <h2>Échéances</h2>
        </div>
        {rentCalls.length > 0 ? (
          <span className="pill-badge">
            {rentCalls.length} échéance{rentCalls.length > 1 ? "s" : ""}
            {enRetard > 0 ? ` · ${enRetard} en retard` : ""}
          </span>
        ) : null}
      </div>

      {rentCalls.length === 0 ? (
        <p className="unit-status-note">
          Aucune échéance enregistrée. La première est créée à la signature du bail ;
          le calendrier mensuel prend le relais ensuite.
        </p>
      ) : (
        <>
          <div className="lease-totals">
            <div>
              <span>Attendu</span>
              <strong>{formatFCFA(attendu)}</strong>
            </div>
            <div>
              <span>Encaissé</span>
              <strong>{formatFCFA(encaisse)}</strong>
            </div>
            <div>
              <span>Reste à encaisser</span>
              <strong>{formatFCFA(Math.max(0, attendu - encaisse))}</strong>
            </div>
          </div>

          <ul className="inventory-list">
            {rentCalls.map((ligne) => {
              const ouverte = echeanceOuverte === ligne.id;
              const solde = Number(ligne.amount_paid) >= Number(ligne.total_amount);
              const reste = Math.max(0, Number(ligne.total_amount) - Number(ligne.amount_paid));

              // Le retard est mesuré à partir de la date d'échéance enregistrée
              // en base, et non d'une date recalculée ici : c'est la même mesure que le
              // statut affiché, qui vient de la source de vérité.
              const joursRetard = Math.floor(
                (Date.now() - new Date(ligne.due_date).getTime()) / 86_400_000,
              );

              const lien = relance
                ? lienRelancePour(relance.whatsappLocataire, {
                    prenomOuNom: relance.nomLocataire,
                    nomAgence: relance.nomAgence,
                    periode: formatPeriode(ligne.period_month, ligne.period_year),
                    totalEcheance: Number(ligne.total_amount),
                    dejaEncaisse: Number(ligne.amount_paid),
                    reste,
                    joursRetard: Math.max(0, joursRetard),
                  })
                : null;

              // Un numéro absent ou inexploitable ne doit pas produire un bouton
              // qui ouvre une page vide : l'agent passe alors par un appel.
              const lienIndisponible =
                !lien && relance?.whatsappLocataire
                  ? normaliserWhatsapp(relance.whatsappLocataire).raison
                  : null;

              return (
                <li key={ligne.id} className="inventory-row">
                  <div className="inventory-row-main">
                    <strong>
                      {MOIS[ligne.period_month - 1] ?? ligne.period_month}{" "}
                      {ligne.period_year}
                    </strong>
                    <small className="inventory-note">
                      {formatFCFA(Number(ligne.amount_paid))} sur{" "}
                      {formatFCFA(Number(ligne.total_amount))}
                    </small>
                  </div>
                  <div className="inventory-row-end">
                    <span
                      className={`condition-chip ${
                        STATUT_STYLE[ligne.status] ?? "condition-neutral"
                      }`}
                    >
                      {STATUT_LABEL[ligne.status] ?? ligne.status}
                    </span>
                    {solde || !lien ? null : (
                      <a
                        className="icon-button"
                        href={lien}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Relancer ${
                          MOIS[ligne.period_month - 1] ?? ligne.period_month
                        } ${ligne.period_year} par WhatsApp`}
                        title="Relancer par WhatsApp"
                      >
                        <MessageCircle size={15} aria-hidden="true" />
                      </a>
                    )}
                    {solde ? null : (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          setEcheanceOuverte(ouverte ? null : ligne.id)
                        }
                        aria-expanded={ouverte}
                        aria-label={`Enregistrer un règlement pour ${
                          MOIS[ligne.period_month - 1] ?? ligne.period_month
                        } ${ligne.period_year}`}
                      >
                        {ouverte ? (
                          <Receipt size={15} aria-hidden="true" />
                        ) : (
                          <PlusCircle size={15} aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>

                  {ouverte ? (
                    <PaymentForm
                      rentCall={ligne}
                      onDone={() => setEcheanceOuverte(null)}
                    />
                  ) : null}

                  {/* Un numéro absent ou illisible ne produit aucun bouton :
                      l'agent est prévenu ici plutôt que de découvrir qu'un
                      lien muet ne partira jamais. */}
                  {!solde && lienIndisponible ? (
                    <small className="inventory-note">{lienIndisponible}</small>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}