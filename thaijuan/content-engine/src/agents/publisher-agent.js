#!/usr/bin/env node

/**
 * Publisher Agent
 * Moves approved Canva-designed drafts into campaign-schedule.json.
 * This does not call Instagram directly; instagram-poster.js handles posting.
 */

const path = require('path');
const { DATA_DIR, CONFIG_DIR, readJson, writeJson } = require('../lib/files');
const { toRawGithubUrl, isHttpUrl } = require('../lib/github-url');
const { log } = require('../lib/log');

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');
const SCHEDULE_PATH = path.join(CONFIG_DIR, 'campaign-schedule.json');

function loadSchedule() {
  const schedule = readJson(SCHEDULE_PATH, { posts: [] });
  if (!Array.isArray(schedule.posts)) schedule.posts = [];
  return schedule;
}

function resolvePostImageUrl(draft) {
  const explicit = draft.githubUrl || draft.canva?.exportedAssetUrl;
  if (explicit && isHttpUrl(explicit)) return explicit;

  const localPath = draft.assetRepoPath || draft.assetLocalPath || draft.canva?.exportedAssetPath;
  if (localPath) return toRawGithubUrl(localPath);

  throw new Error(`Draft ${draft.id} has no publishable asset URL/path.`);
}

function buildSchedulePost(draft) {
  const imageUrl = resolvePostImageUrl(draft);
  return {
    draftId: draft.id,
    date: draft.date,
    scheduledTime: draft.suggestedTime || '18:00',
    restaurantId: draft.restaurantId,
    restaurantName: draft.restaurantName,
    headline: draft.headline || draft.hook,
    description: draft.description || draft.whyGo,
    promotion: `${draft.restaurantName} — ${draft.suburb}`,
    fullCaption: draft.fullCaption || draft.caption,
    hashtags: draft.hashtags || [],
    githubUrl: imageUrl,
    assetRepoPath: draft.assetRepoPath || draft.assetLocalPath || draft.canva?.exportedAssetPath || null,
    canvaDesignUrl: draft.canva?.designUrl || null,
    canvaViewUrl: draft.canva?.viewUrl || null,
    status: 'scheduled',
    posted: false,
    postId: null,
    instagramUrl: null,
    createdAt: new Date().toISOString()
  };
}

function queueApprovedDrafts(options = {}) {
  const drafts = readJson(DRAFTS_PATH, []);
  const schedule = loadSchedule();
  const existingIds = new Set(schedule.posts.map((post) => post.draftId).filter(Boolean));
  const queued = [];
  const errors = [];

  const updatedDrafts = drafts.map((draft) => {
    const targetDraft = options.draftId ? draft.id === options.draftId : true;
    const ready = targetDraft && draft.approvalStatus === 'approved' && !existingIds.has(draft.id);
    if (!ready) return draft;

    try {
      const post = buildSchedulePost(draft);
      schedule.posts.push(post);
      queued.push(draft.id);
      return {
        ...draft,
        approvalStatus: 'scheduled',
        scheduledAt: new Date().toISOString(),
        scheduledPost: {
          date: post.date,
          scheduledTime: post.scheduledTime,
          githubUrl: post.githubUrl
        }
      };
    } catch (error) {
      errors.push(`${draft.id}: ${error.message}`);
      return draft;
    }
  });

  if (queued.length > 0) {
    schedule.posts.sort((a, b) => `${a.date} ${a.scheduledTime}`.localeCompare(`${b.date} ${b.scheduledTime}`));
    writeJson(SCHEDULE_PATH, schedule);
    writeJson(DRAFTS_PATH, updatedDrafts);
  }

  if (errors.length) throw new Error(`Some approved drafts could not be queued:\n- ${errors.join('\n- ')}`);
  return { queued, schedulePath: SCHEDULE_PATH };
}

if (require.main === module) {
  try {
    const draftArg = process.argv.find((arg) => arg.startsWith('--draft-id='));
    const draftId = draftArg ? draftArg.split('=')[1] : undefined;
    const { queued, schedulePath } = queueApprovedDrafts({ draftId });
    log(`✅ Publisher Agent queued ${queued.length} approved draft(s). Schedule: ${schedulePath}`);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { queueApprovedDrafts, buildSchedulePost, resolvePostImageUrl };
