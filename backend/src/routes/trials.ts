import { Router, Request, Response } from 'express';
import { clinicalTrialsService } from '../services/clinicalTrialsService.js';
import type { SearchParams, StudyStatus, StudyPhase, SortOption } from '../types/clinicalTrials.js';

const router = Router();

// Search clinical trials
router.get('/search', async (req: Request, res: Response) => {
  try {
    const {
      condition,
      intervention,
      location,
      sponsor,
      term,
      status,
      phase,
      sort,
      sortOrder,
      pageSize,
      pageToken,
    } = req.query;

    const searchParams: SearchParams = {};

    if (condition && typeof condition === 'string') {
      searchParams.condition = condition;
    }
    if (intervention && typeof intervention === 'string') {
      searchParams.intervention = intervention;
    }
    if (location && typeof location === 'string') {
      searchParams.location = location;
    }
    if (sponsor && typeof sponsor === 'string') {
      searchParams.sponsor = sponsor;
    }
    if (term && typeof term === 'string') {
      searchParams.term = term;
    }
    if (status && typeof status === 'string') {
      searchParams.status = status.split(',') as StudyStatus[];
    }
    if (phase && typeof phase === 'string') {
      searchParams.phase = phase.split(',') as StudyPhase[];
    }
    if (sort && typeof sort === 'string') {
      searchParams.sort = sort as SortOption;
    }
    if (sortOrder && typeof sortOrder === 'string') {
      searchParams.sortOrder = sortOrder as 'asc' | 'desc';
    }
    if (pageSize && typeof pageSize === 'string') {
      searchParams.pageSize = parseInt(pageSize, 10);
    }
    if (pageToken && typeof pageToken === 'string') {
      searchParams.pageToken = pageToken;
    }

    const results = await clinicalTrialsService.searchStudies(searchParams);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Failed to search clinical trials',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get a specific study by NCT ID
router.get('/study/:nctId', async (req: Request, res: Response) => {
  try {
    const { nctId } = req.params;

    if (!nctId || !/^NCT\d{8}$/.test(nctId)) {
      res.status(400).json({
        error: 'Invalid NCT ID format. Expected format: NCT followed by 8 digits (e.g., NCT12345678)',
      });
      return;
    }

    const study = await clinicalTrialsService.getStudyById(nctId);
    res.json(study);
  } catch (error) {
    console.error('Get study error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Study not found',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to get study',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available filter options
router.get('/options', async (_req: Request, res: Response) => {
  res.json({
    status: [
      { value: 'RECRUITING', label: 'Recruiting' },
      { value: 'NOT_YET_RECRUITING', label: 'Not Yet Recruiting' },
      { value: 'ENROLLING_BY_INVITATION', label: 'Enrolling by Invitation' },
      { value: 'ACTIVE_NOT_RECRUITING', label: 'Active, Not Recruiting' },
      { value: 'SUSPENDED', label: 'Suspended' },
      { value: 'TERMINATED', label: 'Terminated' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'WITHDRAWN', label: 'Withdrawn' },
    ],
    phase: [
      { value: 'EARLY_PHASE1', label: 'Early Phase 1' },
      { value: 'PHASE1', label: 'Phase 1' },
      { value: 'PHASE2', label: 'Phase 2' },
      { value: 'PHASE3', label: 'Phase 3' },
      { value: 'PHASE4', label: 'Phase 4' },
      { value: 'NA', label: 'Not Applicable' },
    ],
    sort: [
      { value: 'LastUpdatePostDate', label: 'Last Updated' },
      { value: 'EnrollmentCount', label: 'Enrollment Count' },
      { value: 'StartDate', label: 'Start Date' },
      { value: 'StudyFirstPostDate', label: 'First Posted' },
    ],
  });
});

// Get available fields
router.get('/fields', async (_req: Request, res: Response) => {
  try {
    const fields = await clinicalTrialsService.getStudyFields();
    res.json({ fields });
  } catch (error) {
    console.error('Get fields error:', error);
    res.status(500).json({
      error: 'Failed to get fields',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
