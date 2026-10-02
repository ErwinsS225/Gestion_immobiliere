"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Rotation des arguments marketing.
 *
 * Chaque option est tapee lettre par lettre comme si quelqu un la saisissait au
 * clavier, puis sort en descendant. L angle et le titre partagent le meme
 * mouvement : ils forment une seule entite et disparaissent ensemble.
 *
 * Les caracteres sont decales en cascade, du premier au dernier, avec un delai
 * de quelques millisecondes. Sans ce decalage, tout le texte apparaitrait d un
 * bloc et l effet de frappe serait perdu.
 *
 * La rotation respecte prefers-reduced-motion : dans ce cas le texte change
 * sans animation, sinon la page bouge en boucle sans que l utilisateur l ait
 * demande.
 */
interface OptionMarketing {
    id: number;
    angle: string;
    titre: string;
    sousTitre: string;
}

const OPTIONS: OptionMarketing[] = [
    {
        id: 1,
        angle: "Sérénité Opérationnelle",
        titre: "L’immobilier en toute sérénité.",
        sousTitre:
            "Automatisez vos échéances et vos relances WhatsApp. Libérez-vous des tâches répétitives pour piloter votre agence l’esprit tranquille.",
    },
    {
        id: 2,
        angle: "Efficacité et Gain de Temps",
        titre: "Maîtrisez votre gestion, libérez votre temps.",
        sousTitre:
            "Fini les oublis et les tableaux Excel. Laissez notre technologie gérer le suivi locatif et les rappels automatiques pendant que vous développez votre portefeuille.",
    },
    {
        id: 3,
        angle: "Excellence et Image de Marque",
        titre: "L’excellence opérationnelle pour votre agence.",
        sousTitre:
            "Centralisez la gestion de vos lots, anticipez les échéances et offrez une communication proactive à vos locataires. Élevez le standard de votre gestion locative.",
    },
];

/** Duree de chaque lettre, en millisecondes. */
const FRAPPE = 26;

/** Intervalle entre deux options, en millisecondes. */
const ROTATION = 7200;

/** Escalade vers le bas a la disparition, lisible sur fond vert. */
const sortie = {
    initial: { opacity: 0, y: 0 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -14 },
};

/**
 * Un texte dont chaque lettre arrive separement.
 *
 * Chaque caractere est son propre mouvement : c est ce qui produit l effet de
 * frappe. Le texte reste lisible pour un lecteur d ecran, le rendu anime est
 * purement visuel.
 */
function TexteFrappe({ texte, delai = 0 }: { texte: string; delai?: number }) {
    return (
        <>
            {Array.from(texte).map((caractere, index) => (
                <motion.span
                    // L index tient lieu de cle : deux caracteres identiques
                    // dans le meme texte ne doivent pas partager un identifiant.
                    key={`${index}-${caractere}`}
                    initial={{ opacity: 0, y: "0.28em" }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.22,
                        delay: delai + index * FRAPPE,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    // L espace ne doit pas occuper de largeur visible ni
                    // declencher d animation sans effet.
                    style={{ display: "inline-block", whiteSpace: "pre" }}
                >
                    {caractere === " " ? " " : caractere}
                </motion.span>
            ))}
        </>
    );
}

export function RotatingPitch() {
    const [index, setIndex] = useState(0);
    const sansMouvement = useReducedMotion();

    useEffect(() => {
        if (sansMouvement) return;

        const minuteur = window.setInterval(() => {
            setIndex((precedent) => (precedent + 1) % OPTIONS.length);
        }, ROTATION);

        // L intervalle survivrait au demontage du composant et continuerait
        // de mettre a jour un composant gone, d ou le nettoyage explicite.
        return () => window.clearInterval(minuteur);
    }, [sansMouvement]);

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={OPTIONS[index].id}
                variants={sortie}
                initial="initial"
                animate="animate"
                exit="exit"
                // La sortie doit avoir le temps de se lire avant que la suivante
                // n entre, sinon les deux textes se chevauchent.
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            >
                <span className="brand-eyebrow">
                    <TexteFrappe texte={OPTIONS[index].angle} />
                </span>
                <h1>
                    <TexteFrappe texte={OPTIONS[index].titre} delai={0.1} />
                </h1>
                <p>
                    <TexteFrappe texte={OPTIONS[index].sousTitre} delai={0.35} />
                </p>
            </motion.div>
        </AnimatePresence>
    );
}