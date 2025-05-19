# Restructuration du projet Atelier des Composites

Ce document détaille la restructuration du code frontend de l'application Atelier des Composites, en particulier la décomposition du fichier App.jsx en plusieurs sous-fichiers pour améliorer la lisibilité, la maintenabilité et l'évolutivité du code.

## Objectifs

- Décomposer le fichier App.jsx en plusieurs modules plus petits et spécialisés
- Conserver toutes les fonctionnalités existantes
- Améliorer la lisibilité et la maintenabilité du code
- Faciliter les évolutions futures

## Structure du projet restructuré

```
src/
├── assets/            # Ressources statiques (images, etc.)
├── components/        # Composants React
│   ├── editor/        # Composants spécifiques à l'éditeur
│   │   ├── Grid.jsx   # Composant pour afficher la grille
│   │   ├── ShapeEditor.jsx  # Composant principal d'édition
│   │   └── Toolbar.jsx      # Barre d'outils
│   ├── PieceCreationVisualizer.jsx
│   ├── ProductionTracker.jsx
│   ├── SaveSVGModal.jsx
│   ├── SVGLibraryPanel.jsx
│   └── SvgCanvas.jsx
├── constants/         # Constantes globales
│   └── config.js      # Configuration générale
├── hooks/             # Hooks personnalisés
│   ├── useDrawingTools.js    # Outils de dessin
│   ├── useGrid.js            # Gestion de la grille
│   ├── useHistoryState.js    # Gestion de l'historique (undo/redo)
│   ├── useKeyboardEvents.js  # Gestion des événements clavier
│   ├── useShapePersistence.js # Persistance des formes
│   └── useViewBox.js         # Gestion du viewBox (zoom/pan)
├── pages/             # Pages de l'application
│   └── ProductionPage.jsx
├── utils/             # Fonctions utilitaires
│   ├── shapeUtils.js  # Utilitaires pour les formes
│   ├── svgUtils.js    # Utilitaires pour le SVG
│   └── vectorUtils.js # Utilitaires mathématiques pour les vecteurs
├── App.jsx            # Composant principal
├── NewApp.jsx         # Nouvelle version du composant principal
├── index.css
└── main.jsx
```

## Démarche de mise en œuvre

La refactorisation a suivi une approche méthodique pour éviter de perturber les fonctionnalités existantes:

1. **Analyse du code existant**: Identification des grandes sections et responsabilités dans App.jsx
2. **Extraction des fonctions utilitaires**: Déplacement des fonctions mathématiques et géométriques dans des modules spécialisés
3. **Création de hooks personnalisés**: Encapsulation des logiques d'état et de comportement dans des hooks réutilisables
4. **Création de composants spécialisés**: Décomposition de l'interface utilisateur en composants modulaires
5. **Intégration progressive**: Création d'un nouveau composant App qui utilise les modules refactorisés

## Modules et hooks créés

### Utilitaires

- **vectorUtils.js**: Opérations mathématiques sur les vecteurs
- **shapeUtils.js**: Fonctions pour manipuler les formes (polygones, etc.)
- **svgUtils.js**: Fonctions pour générer et manipuler les SVG

### Hooks personnalisés

- **useHistoryState**: Gestion de l'historique des actions pour les fonctionnalités d'annulation/rétablissement
- **useShapePersistence**: Sauvegarde automatique des formes dans le sessionStorage
- **useKeyboardEvents**: Gestion des raccourcis clavier
- **useGrid**: Gestion de la grille et du système d'ancrage
- **useViewBox**: Contrôle du zoom et du panoramique sur le canvas SVG
- **useDrawingTools**: Gestion des outils de dessin de formes prédéfinies

### Composants

- **Grid.jsx**: Affichage de la grille et des axes
- **Toolbar.jsx**: Interface utilisateur pour les outils d'édition
- **ShapeEditor.jsx**: Composant principal d'édition qui réunit tous les hooks et sous-composants

## Comment passer à la nouvelle structure

Pour passer de l'ancienne structure à la nouvelle:

1. S'assurer que tous les fichiers ont été correctement créés avec leur contenu
2. Remplacer l'ancien App.jsx par le nouveau, ou utiliser le fichier NewApp.jsx comme point de départ
3. Mettre à jour les imports dans main.jsx pour utiliser le nouveau composant App

## Avantages de la nouvelle structure

- **Meilleure organisation**: Le code est organisé en modules fonctionnels clairs
- **Réutilisabilité**: Les hooks et utilitaires peuvent être réutilisés dans d'autres parties de l'application
- **Testabilité**: Les modules isolés sont plus faciles à tester
- **Maintenabilité**: Les modifications et corrections sont plus faciles à réaliser
- **Évolutivité**: Ajouter de nouvelles fonctionnalités est plus simple car le code est modulaire

## Fonctionnalités préservées

Toutes les fonctionnalités de l'application d'origine ont été préservées:

- Dessin à main levée de formes
- Outils de dessin de formes prédéfinies (rectangle, carré, cercle)
- Édition des sommets et des segments
- Arrondi des coins
- Mode orthogonal
- Grille et ancrage
- Zoom et panoramique
- Annulation et rétablissement
- Sauvegarde et chargement de SVG
- Bibliothèque de formes

## Prochaines étapes recommandées

Pour continuer l'amélioration du projet:

1. Ajouter des tests unitaires pour les modules créés
2. Améliorer la gestion des erreurs
3. Optimiser les performances du rendu SVG
4. Ajouter des fonctionnalités d'exportation vers d'autres formats
5. Implémenter une gestion d'utilisateurs pour sauvegarder les formes de manière persistante 