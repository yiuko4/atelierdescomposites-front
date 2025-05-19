# Guide de transition vers la nouvelle architecture

Ce guide détaille les étapes à suivre pour passer de l'ancienne structure de code à la nouvelle architecture modulaire. La transition peut se faire progressivement pour minimiser les risques.

## Étape 1: Mise en place des fichiers utilitaires

Commencez par intégrer les modules utilitaires qui n'interfèrent pas avec le code existant:

1. Créez les répertoires manquants:
```
mkdir -p src/utils src/constants src/hooks src/components/editor
```

2. Ajoutez les fichiers utilitaires:
- `src/utils/vectorUtils.js`
- `src/utils/shapeUtils.js`
- `src/utils/svgUtils.js`
- `src/constants/config.js`

## Étape 2: Intégration des hooks personnalisés

Ajoutez les hooks personnalisés:

1. Créez les fichiers de hooks:
- `src/hooks/useHistoryState.js`
- `src/hooks/useShapePersistence.js`
- `src/hooks/useKeyboardEvents.js`
- `src/hooks/useGrid.js`
- `src/hooks/useViewBox.js`
- `src/hooks/useDrawingTools.js`

## Étape 3: Création des composants d'interface

1. Ajoutez les composants de l'éditeur:
- `src/components/editor/Grid.jsx`
- `src/components/editor/Toolbar.jsx`
- `src/components/editor/ShapeEditor.jsx`

## Étape 4: Configuration et tests de la nouvelle structure

1. Créez le nouveau fichier App dans `src/NewApp.jsx`

2. Pour tester la nouvelle structure sans impacter l'application existante, vous pouvez créer une route temporaire dans `main.jsx`:

```jsx
import NewApp from './NewApp.jsx'

// ... code existant

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/new',
    element: <NewApp />,
  },
  {
    path: '/production/:jobId',
    element: <ProductionPage />,
  },
])
```

Accédez ensuite à `http://localhost:3000/new` pour tester la nouvelle interface.

## Étape 5: Transition complète

Une fois que la nouvelle structure fonctionne correctement:

1. Renommez `NewApp.jsx` en `App.jsx` (sauvegardez d'abord l'ancien fichier comme `OldApp.jsx` si nécessaire):
```
mv src/App.jsx src/OldApp.jsx
mv src/NewApp.jsx src/App.jsx
```

2. Mettez à jour les imports dans `main.jsx` si nécessaire.

## Étape 6: Nettoyage

Après avoir vérifié que tout fonctionne correctement:

1. Supprimez l'ancien fichier App.jsx si vous l'avez sauvegardé:
```
rm src/OldApp.jsx
```

2. Supprimez la route temporaire si vous en avez créé une.

## Conseils pour la transition

- **Tests unitaires**: Si possible, ajoutez des tests unitaires pour les nouveaux modules avant de faire la transition complète.
- **Déploiement graduel**: Envisagez un déploiement progressif pour les utilisateurs internes avant de le rendre disponible à tous.
- **Conservation des données**: La nouvelle structure utilise le même système de persistance (sessionStorage), donc les formes sauvegardées devraient rester accessibles.
- **Documentation**: Mettez à jour la documentation pour refléter la nouvelle structure et les nouvelles fonctionnalités.

## Dépannage

### Problèmes courants et solutions

1. **Erreurs d'import**:
   - Vérifiez les chemins relatifs dans les imports
   - Assurez-vous que tous les fichiers sont créés au bon endroit

2. **Incompatibilités de composants**:
   - Vérifiez que les props passées aux composants correspondent à ce qu'ils attendent
   - Inspectez les erreurs dans la console du navigateur

3. **Problèmes de state**:
   - Vérifiez que la migration vers les hooks personnalisés n'a pas modifié le comportement attendu
   - Utilisez React DevTools pour inspecter l'état des composants

4. **Problèmes de performance**:
   - Si vous constatez des problèmes de performance, vérifiez les dépendances des useCallback/useEffect
   - Assurez-vous que les fonctions de rendu ne sont pas recréées inutilement

## Vérification post-transition

Après la transition, vérifiez que toutes les fonctionnalités suivantes fonctionnent correctement:

- [ ] Dessin à main levée
- [ ] Création de formes prédéfinies (rectangle, carré, cercle)
- [ ] Sélection et édition de sommets
- [ ] Arrondi des coins
- [ ] Grille et ancrage
- [ ] Zoom et panoramique
- [ ] Annulation et rétablissement
- [ ] Sauvegarde et chargement de SVG
- [ ] Bibliothèque de formes
- [ ] Mode orthogonal
- [ ] Tous les raccourcis clavier 