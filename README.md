# VentePro / VenteX AI

Application React + Electron de gestion commerciale locale: produits, stock, caisse, clients, crédits, devis, trésorerie, employés et agents IA optionnels.

## Lancement

```bash
npm start
```

Puis ouvrir `http://localhost:3000`.

Pour Electron en développement:

```bash
npm start
npm run electron
```

## Comptes par défaut

- Admin: profil `Administrateur`, mot de passe `admin00`
- Vendeur: profil `Vendeur`, mot de passe `0000`
- Employés: les employés actifs avec un PIN apparaissent aussi sur l'écran de connexion.

Les mots de passe principaux se changent dans `Paramètres > Sécurité`.

## Données

Les données sont stockées localement dans IndexedDB. Utiliser `Paramètres > Données` pour exporter/importer une sauvegarde JSON complète.

Les agents IA et le scan caméra nécessitent une clé Groq configurée dans `Paramètres > IA & Groq`. Sans clé, l'application reste utilisable avec les données locales.

## Build

```bash
npm run build
npm run dist
```

La licence est vérifiée dans l'application Electron via l'écran d'activation. Le mode navigateur local reste accessible pour le développement.
