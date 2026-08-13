import express from "express";
import { db } from "../shared.js";

const router = express.Router();

/**
 * GET /api/admin/audit-scrims
 * Audits the tournaments collection for records that are likely scrims
 * but are missing matchType or have matchType='tournament' when they should be 'scrims'.
 *
 * Heuristics for detecting mislabeled scrims:
 * - matchType field is missing AND isScrim is true
 * - isScrim is true but matchType is 'tournament'
 * - Title contains "scrim" (case-insensitive) but matchType is not 'scrims'
 */
router.get("/api/admin/audit-scrims", async (req, res) => {
  try {
    const snapshot = await db.collection("tournaments").get();
    const suspects: any[] = [];

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const id = doc.id;
      const matchType = data.matchType;
      const isScrim = data.isScrim;
      const title = (data.title || "").toLowerCase();

      const issues: string[] = [];

      // Case 1: isScrim=true but matchType is missing or 'tournament'
      if (isScrim === true && (!matchType || matchType === 'tournament')) {
        issues.push(`isScrim=true but matchType=${matchType || 'missing'}`);
      }

      // Case 2: title contains "scrim" but matchType is not 'scrims'
      if (title.includes('scrim') && matchType !== 'scrims') {
        issues.push(`title contains "scrim" but matchType=${matchType || 'missing'}`);
      }

      // Case 3: matchType is missing entirely (legacy records)
      if (!matchType && !isScrim) {
        issues.push(`matchType missing (no isScrim flag)`);
      }

      if (issues.length > 0) {
        suspects.push({
          id,
          title: data.title,
          matchType: matchType || null,
          isScrim: isScrim || false,
          status: data.status,
          game: data.game,
          issues,
        });
      }
    });

    res.json({
      total: snapshot.size,
      suspects: suspects.length,
      suspectsWithIsScrim: suspects.filter(s => s.isScrim).length,
      suspectsWithTitleMatch: suspects.filter(s => s.issues.some((i: string) => i.includes('title'))).length,
      suspectsWithMissingMatchType: suspects.filter(s => s.issues.some((i: string) => i.includes('matchType missing'))).length,
      details: suspects,
    });
  } catch (e: any) {
    console.error("Scrim audit error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/admin/fix-scrims
 * Fixes mislabeled scrims by setting matchType='scrims' for records identified as scrims.
 *
 * Body: { ids?: string[], dryRun?: boolean }
 * - If ids is provided, only fix those records. Otherwise fix all suspects with isScrim=true or title containing "scrim".
 * - If dryRun is true, return what would be changed without writing.
 */
router.post("/api/admin/fix-scrims", async (req, res) => {
  try {
    const { ids, dryRun } = req.body;
    const batch = db.batch();
    const updates: any[] = [];

    const snapshot = await db.collection("tournaments").get();

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const id = doc.id;

      // If specific IDs requested, only process those
      if (ids && Array.isArray(ids) && !ids.includes(id)) return;

      const matchType = data.matchType;
      const isScrim = data.isScrim;
      const title = (data.title || "").toLowerCase();

      const shouldFix =
        (isScrim === true && (!matchType || matchType === 'tournament')) ||
        (title.includes('scrim') && matchType !== 'scrims');

      if (shouldFix) {
        updates.push({
          id,
          title: data.title,
          oldMatchType: matchType || null,
          newMatchType: 'scrims',
          isScrim: isScrim || false,
        });

        if (!dryRun) {
          batch.update(doc.ref, {
            matchType: 'scrims',
            isScrim: true,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    if (!dryRun && updates.length > 0) {
      await batch.commit();
    }

    res.json({
      dryRun: !!dryRun,
      fixed: updates.length,
      updates,
    });
  } catch (e: any) {
    console.error("Scrim fix error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
