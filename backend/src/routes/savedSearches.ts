import { Router, Request, Response } from 'express';
import type { SavedSearch, SearchParams } from '../types/clinicalTrials.js';

const router = Router();

// In-memory storage for saved searches (replace with database in production)
const savedSearches: Map<string, SavedSearch> = new Map();

// Generate unique ID
function generateId(): string {
  return `search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get all saved searches
router.get('/', (_req: Request, res: Response) => {
  const searches = Array.from(savedSearches.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  res.json({ searches });
});

// Get a specific saved search
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const search = savedSearches.get(id);

  if (!search) {
    res.status(404).json({ error: 'Saved search not found' });
    return;
  }

  res.json(search);
});

// Create a new saved search
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, params } = req.body as { name: string; params: SearchParams };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    if (!params || typeof params !== 'object') {
      res.status(400).json({ error: 'Search params are required' });
      return;
    }

    const id = generateId();
    const now = new Date().toISOString();

    const savedSearch: SavedSearch = {
      id,
      name: name.trim(),
      params,
      createdAt: now,
      updatedAt: now,
    };

    savedSearches.set(id, savedSearch);
    res.status(201).json(savedSearch);
  } catch (error) {
    console.error('Create saved search error:', error);
    res.status(500).json({
      error: 'Failed to create saved search',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update a saved search
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, params } = req.body as { name?: string; params?: SearchParams };

    const existingSearch = savedSearches.get(id);
    if (!existingSearch) {
      res.status(404).json({ error: 'Saved search not found' });
      return;
    }

    const updatedSearch: SavedSearch = {
      ...existingSearch,
      name: name?.trim() || existingSearch.name,
      params: params || existingSearch.params,
      updatedAt: new Date().toISOString(),
    };

    savedSearches.set(id, updatedSearch);
    res.json(updatedSearch);
  } catch (error) {
    console.error('Update saved search error:', error);
    res.status(500).json({
      error: 'Failed to update saved search',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete a saved search
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!savedSearches.has(id)) {
    res.status(404).json({ error: 'Saved search not found' });
    return;
  }

  savedSearches.delete(id);
  res.status(204).send();
});

export default router;
