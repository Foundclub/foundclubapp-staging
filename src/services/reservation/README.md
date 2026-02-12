# Services Réservation - Documentation

## Vue d'ensemble

Ce dossier contient les services et hooks pour interagir avec l'API des réservations et des featured items.

## Fichiers

### `reservationService.js`

Service de base pour les appels API liés aux réservations.

#### Fonctions

##### `getReservations(filters)`

Récupère la liste des réservations avec filtres et pagination.

**Paramètres:**
```typescript
{
  page?: number;          // Numéro de page (default: 1)
  pageSize?: number;      // Items par page (default: 15)
  q?: string;             // Recherche textuelle
  type?: string;          // Filtrer par type d'événement
  reservationMode?: string; // FULL_GROUP | RECRUITING
  club?: string;          // ID du club
}
```

**Retour:**
```typescript
Promise<{
  data: Reservation[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    }
  }
}>
```

**Gestion d'erreur:** Retourne structure vide en cas d'échec (pas de throw).

**Exemple:**
```javascript
import { getReservations } from '@/services/reservation/reservationService';

const result = await getReservations({ 
  page: 1, 
  pageSize: 10,
  reservationMode: 'RECRUITING'
});
```

---

##### `getFeaturedReservations(limit)`

Récupère les réservations mises à la une ou les dernières réservations en fallback.

**Paramètres:**
- `limit` (number, optional): Nombre max d'items (default: 10)

**Retour:**
```typescript
Promise<{
  data: Reservation[];
  meta: {
    isFeatured: boolean;  // true si featured, false si fallback
    pagination: PaginationInfo;
  }
}>
```

**Gestion d'erreur:** Retourne structure vide en cas d'échec.

**Exemple:**
```javascript
import { getFeaturedReservations } from '@/services/reservation/reservationService';

const result = await getFeaturedReservations(5);
if (result.meta.isFeatured) {
  console.log('Displaying featured items');
} else {
  console.log('Displaying fallback (latest reservations)');
}
```

---

##### `joinReservation(reservationId)`

Participe à une réservation.

**Paramètres:**
- `reservationId` (string): Document ID de la réservation

**Retour:**
```typescript
Promise<{
  data: Reservation;
}>
```

**Exemple:**
```javascript
import { joinReservation } from '@/services/reservation/reservationService';

try {
  const result = await joinReservation('reservation-123');
  console.log('Joined successfully', result.data);
} catch (error) {
  console.error('Failed to join', error);
}
```

---

##### `createReservation(reservationData)`

Crée une nouvelle réservation.

**Paramètres:**
```typescript
{
  mode: 'FULL_GROUP' | 'RECRUITING';
  totalPlayers: number;
  currentPlayers: number;
  pricePerPerson: number;
  date: string;           // Format: ISO 8601
  startTime?: string;     // Format: HH:mm
  endTime?: string;       // Format: HH:mm
  description?: string;
  location?: object;      // Objet location picker
  locationDetails?: string;
  club?: string;          // Document ID du club
  team?: string;          // Document ID de l'équipe
}
```

**Retour:**
```typescript
Promise<{
  data: Reservation;
}>
```

**Exemple:**
```javascript
import { createReservation } from '@/services/reservation/reservationService';

const newReservation = await createReservation({
  mode: 'RECRUITING',
  totalPlayers: 10,
  currentPlayers: 5,
  pricePerPerson: 15.00,
  date: '2025-12-01T18:00:00.000Z',
  startTime: '18:00',
  endTime: '20:00',
  description: 'Match de football amical',
  team: 'team-abc-123'
});
```

---

### `reservationQueries.js`

Hooks React Query pour gérer le cache et les requêtes de réservations.

#### Hooks

##### `useGetReservations(filters)`

Hook avec pagination infinie pour récupérer les réservations.

**Paramètres:** Mêmes que `getReservations()`

**Retour:**
```typescript
{
  data: {
    pages: Array<{
      data: Reservation[];
      meta: PaginationInfo;
    }>;
    pageParams: number[];
  };
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
}
```

**Configuration:**
- `staleTime`: 5 minutes
- `cacheTime`: 10 minutes
- Pagination infinie automatique

**Exemple:**
```javascript
import { useGetReservations } from '@/services/reservation/reservationQueries';

function ReservationList() {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
  } = useGetReservations({ pageSize: 15 });

  const reservations = data?.pages?.flatMap(page => page.data) || [];

  return (
    <FlatList
      data={reservations}
      onEndReached={() => hasNextPage && fetchNextPage()}
    />
  );
}
```

---

##### `useGetFeaturedReservations(limit)`

Hook pour récupérer les réservations featured avec cache.

**Paramètres:**
- `limit` (number, optional): Nombre max d'items

**Retour:**
```typescript
{
  data: {
    data: Reservation[];
    meta: {
      isFeatured: boolean;
      pagination: PaginationInfo;
    }
  };
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

**Configuration:**
- `staleTime`: 5 minutes
- `cacheTime`: 10 minutes
- `retry`: 2

**Exemple:**
```javascript
import { useGetFeaturedReservations } from '@/services/reservation/reservationQueries';

function FeaturedSection() {
  const { data, isLoading, error } = useGetFeaturedReservations(10);

  if (isLoading) return <Loader />;
  if (error || !data?.data) return null;

  const items = data.data;
  const isFeatured = data.meta?.isFeatured;

  return (
    <ScrollView horizontal>
      {items.map(item => (
        <FeaturedCard key={item.documentId} item={item} />
      ))}
    </ScrollView>
  );
}
```

---

## Schéma de données

### Type: `Reservation`

```typescript
interface Reservation {
  documentId: string;
  date: string;           // ISO 8601
  description?: string;
  location?: {
    lat: number;
    lng: number;
  };
  locationDetails?: string;
  pricePerPerson: number;
  reservationMode: 'FULL_GROUP' | 'RECRUITING';
  totalPlayers: number;
  currentPlayers: number;
  missingPlayers: number;
  startTime?: string;     // HH:mm
  endTime?: string;       // HH:mm
  type: {
    name: string;         // "Réservation"
    documentId: string;
  };
  team?: {
    name: string;
    documentId: string;
  };
  club?: {
    name: string;
    documentId: string;
  };
  organizer?: {
    username: string;
    documentId: string;
  };
  participations?: User[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Gestion d'erreurs

### Stratégies

**Services (`reservationService.js`):**
- `getReservations()`: Retourne structure vide en cas d'erreur
- `getFeaturedReservations()`: Retourne structure vide en cas d'erreur
- `joinReservation()`: Throw l'erreur (à gérer par le composant)
- `createReservation()`: Throw l'erreur (à gérer par le composant)

**Hooks (`reservationQueries.js`):**
- Les erreurs sont exposées via la propriété `error`
- Les composants doivent gérer `error` pour afficher un message approprié

**Exemple de gestion d'erreur:**
```javascript
const { data, error, isLoading } = useGetReservations();

if (error) {
  return (
    <View>
      <Text>Une erreur est survenue</Text>
      <Text>{error.message}</Text>
    </View>
  );
}
```

---

## Tests

### Tests unitaires

Voir `__tests__/reservationService.test.js` et `__tests__/reservationQueries.test.js`.

**Couverture:**
- ✅ getReservations avec différents filtres
- ✅ getFeaturedReservations (featured + fallback)
- ✅ Gestion d'erreurs
- ✅ Hooks React Query (mocking)

**Lancer les tests:**
```bash
cd app
npm test -- reservationService
```

---

## Exemple complet d'utilisation

### Composant avec featured items et liste

```javascript
import React from 'react';
import { View, ScrollView, FlatList } from 'react-native';
import { 
  useGetReservations,
  useGetFeaturedReservations 
} from '@/services/reservation/reservationQueries';

function ReservationScreen() {
  // Featured items
  const {
    data: featuredData,
    isLoading: isFeaturedLoading,
    error: featuredError,
  } = useGetFeaturedReservations(5);

  // Liste complète avec pagination infinie
  const {
    data: pagesData,
    isLoading,
    hasNextPage,
    fetchNextPage,
  } = useGetReservations({ pageSize: 15 });

  const reservations = pagesData?.pages?.flatMap(p => p.data) || [];
  const featuredItems = featuredData?.data || [];

  return (
    <View>
      {/* Section À la une */}
      {!isFeaturedLoading && !featuredError && featuredItems.length > 0 && (
        <ScrollView horizontal>
          {featuredItems.map(item => (
            <FeaturedCard key={item.documentId} item={item} />
          ))}
        </ScrollView>
      )}

      {/* Liste complète */}
      <FlatList
        data={reservations}
        renderItem={({ item }) => <ReservationCard item={item} />}
        onEndReached={() => hasNextPage && fetchNextPage()}
        refreshing={isLoading}
      />
    </View>
  );
}
```

---

## Dépendances

- `@tanstack/react-query`: Gestion du cache et des requêtes
- `axios`: Client HTTP (via `@/services/client`)
- `joi`: Validation des schémas

---

## Troubleshooting

### Hook retourne toujours vide

**Symptômes:** `data === undefined` ou `data.data === []`

**Solutions:**
1. Vérifier que le backend est lancé
2. Vérifier l'URL de l'API dans `@/services/client`
3. Vérifier les logs réseau dans React Native Debugger
4. Vérifier que l'authentification est OK (si nécessaire)

---

### Featured items ne s'affichent pas

**Debug:**
1. Vérifier `data.meta.isFeatured` → devrait être `true` si featured
2. Vérifier qu'il existe des featured-items actifs dans Strapi
3. Tester l'API directement: `curl http://localhost:1337/api/featured-items/reservations`
4. Vérifier la console: `featuredError` est-il défini ?

---

## Références

- [React Query Docs](https://tanstack.com/query/latest)
- [API Backend README](../../../admin/src/api/featured-item/README.md)
- [Spécification complète](../../../docs/FEATURED_ITEMS_SPECIFICATION.md)





