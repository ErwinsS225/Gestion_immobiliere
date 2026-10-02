"use client";

import { useState } from "react";
import { PlusCircle, Receipt } from "lucide-react";
import { PaymentForm, type RentCallForPayment } from "@/components/payment-form";
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

/**
 * Suivi des échéances d'un bail, avec l'enregistrement d'un règlement.
 *
 * Le composant est côté client parce que l'ouverture de la modale relève de
 * l'état local. Le statut affiché n'est jamais calculé ici : il vient de la
 * base, où le trigger l'a recalculé après chaque règlement confirmé. Le
 * formulaire ne fait qu'afficher ce que la source de vérité dit.
 */
export function RentCallTracker({ rentCalls }: { rentCalls: RentCallForPayment[] }) {
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
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}