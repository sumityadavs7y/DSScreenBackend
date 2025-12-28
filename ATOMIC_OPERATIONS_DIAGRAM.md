# Atomic Operations - Visual Flow Diagrams

## 📤 Upload Operation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT-SIDE UPLOAD                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Request Upload  │
                    │   Pre-signed    │
                    │      URL        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Create Inactive│
                    │   DB Record     │
                    │  (videoId, etc) │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Generate S3    │
                    │  Pre-signed URL │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Client Uploads │
                    │   Directly to   │
                    │       S3        │
                    └────────┬────────┘
                             │
┌────────────────────────────┴────────────────────────────┐
│               SERVER-SIDE PROCESSING                    │
│                    (ATOMIC)                             │
└─────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Verify S3 File  │
                    │     Exists      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Download Temp   │
                    │  Extract Meta   │
                    │ Generate Thumb  │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │  START DB TRANSACTION    │
              └──────────────────────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
                   ▼                   ▼
          ┌────────────────┐  ┌────────────────┐
          │ Update Video   │  │ Upload Thumb   │
          │   Metadata     │  │    to S3       │
          │  Mark Active   │  │                │
          └────────┬───────┘  └────────┬───────┘
                   │                   │
                   └─────────┬─────────┘
                             ▼
                   ┌──────────────────┐
                   │ Update Storage   │
                   │     Usage        │
                   └─────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   COMMIT TRANSACTION?    │
              └──────────┬───────┬───────┘
                         │       │
                    SUCCESS     FAILURE
                         │       │
                         ▼       ▼
              ┌──────────┐   ┌──────────────────┐
              │  COMMIT  │   │    ROLLBACK      │
              │   ✅      │   │  DELETE S3 FILE  │
              │          │   │  DELETE THUMB    │
              │          │   │  DELETE DB REC   │
              │          │   │       ❌          │
              └──────────┘   └──────────────────┘
```

## 🗑️ Delete Operation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DELETE REQUEST                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Verify User    │
                    │   Has Access    │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │  START DB TRANSACTION    │
              └──────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│              STEP 1: DELETE FROM S3                    │
│              (OUTSIDE TRANSACTION)                     │
└────────────────────────────────────────────────────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
             S3 SUCCESS           S3 FAILURE
                   │                   │
                   ▼                   ▼
          ┌────────────────┐  ┌────────────────┐
          │ File Deleted   │  │  ROLLBACK      │
          │      ✅         │  │  Return Error  │
          │                │  │      ❌         │
          └────────┬───────┘  └────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│              STEP 2: DELETE THUMBNAIL                  │
│              (OUTSIDE TRANSACTION)                     │
└────────────────────────────────────────────────────────┘
                   │
                   ▼  (continues even if fails)
                   │
┌────────────────────────────────────────────────────────┐
│        STEP 3: DATABASE OPERATIONS                     │
│          (WITHIN TRANSACTION)                          │
└────────────────────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┬─────────────┐
         │                   │             │
         ▼                   ▼             ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Remove from    │  │ Delete Video   │  │ Update Storage │
│   Schedules    │  │    Record      │  │     Usage      │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                    │
         └───────────────────┴────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   COMMIT TRANSACTION?    │
              └──────────┬───────┬───────┘
                         │       │
                    SUCCESS     FAILURE
                         │       │
                         ▼       ▼
              ┌──────────┐   ┌──────────────────┐
              │  COMMIT  │   │    ROLLBACK      │
              │   ✅      │   │  (DB unchanged)  │
              │          │   │  (S3 deleted*)   │
              │          │   │       ⚠️          │
              └──────────┘   └──────────────────┘
                                      │
                                      ▼
                          ┌────────────────────┐
                          │ Orphaned S3 File   │
                          │  (Very Rare)       │
                          │ Run cleanup script │
                          └────────────────────┘
```

## 🔄 Bulk Delete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  BULK DELETE REQUEST                            │
│                  (Array of Video IDs)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   For Each Video:     │
                  │   ┌─────────────────┐ │
                  │   │ Start Individual│ │
                  │   │  Transaction    │ │
                  │   └────────┬────────┘ │
                  │            │          │
                  │   ┌────────▼────────┐ │
                  │   │  Delete from S3 │ │
                  │   └────────┬────────┘ │
                  │            │          │
                  │   ┌────────▼────────┐ │
                  │   │ Delete from DB  │ │
                  │   │ Update Storage  │ │
                  │   └────────┬────────┘ │
                  │            │          │
                  │   ┌────────▼────────┐ │
                  │   │ Commit or       │ │
                  │   │ Rollback        │ │
                  │   └────────┬────────┘ │
                  │            │          │
                  └────────────┼──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
     ┌────────────────┐              ┌────────────────┐
     │  Success List  │              │   Failed List  │
     │   (deleted)    │              │   (skipped)    │
     └────────────────┘              └────────────────┘
              │                                 │
              └────────────────┬────────────────┘
                               ▼
                     ┌──────────────────┐
                     │  Return Results  │
                     │  {deleted: N,    │
                     │   failed: M}     │
                     └──────────────────┘
```

## 🔐 Transaction Isolation

```
┌────────────────────────────────────────────────────────────┐
│                    Transaction 1                           │
│   User A Deletes Video X                                   │
│                                                            │
│   [START]──→[S3]──→[DB]──→[COMMIT]                        │
│                       ▲                                    │
└───────────────────────┼────────────────────────────────────┘
                        │ Isolated (no interference)
┌───────────────────────┼────────────────────────────────────┐
│                       ▼                                    │
│                    Transaction 2                           │
│   User B Deletes Video Y                                   │
│                                                            │
│   [START]──→[S3]──→[DB]──→[COMMIT]                        │
└────────────────────────────────────────────────────────────┘

RESULT: Both transactions succeed independently
        No race conditions
        No deadlocks
```

## ⚠️ Failure Scenarios

### Scenario 1: Upload - Metadata Extraction Fails

```
Client                  S3                    Database
  │                     │                         │
  ├─[Upload File]──────→│                         │
  │                     │←────[File Stored]       │
  │                     │                         │
  ├─[Complete Upload]───┴─→[Download Temp]       │
  │                        [Extract Meta]         │
  │                              ❌ FAIL          │
  │                        [START TRANSACTION]    │
  │                        [Rollback]─────────────┤
  │                     ┌─[Delete File]           │
  │                     │←─[File Deleted]         │
  │                     │  [Delete Record]────────┤
  │←──[Error: Upload Failed]                      │
  │                     │                         │
  
RESULT: ✅ Clean state, nothing left behind
```

### Scenario 2: Delete - S3 Fails

```
Client                  S3                    Database
  │                     │                         │
  ├─[Delete Request]────┴─→[START TRANSACTION]   │
  │                        [Try Delete S3]────────→│
  │                              ❌ FAIL          │
  │                        [Rollback]─────────────┤
  │←──[Error: Delete Failed]                      │
  │                     │                         │
  │                   ✅Still                   ✅Still
  │                   Exists                   Exists
  
RESULT: ✅ Consistent state, video still intact
```

### Scenario 3: Delete - DB Fails After S3

```
Client                  S3                    Database
  │                     │                         │
  ├─[Delete Request]────┴─→[START TRANSACTION]   │
  │                        [Delete S3]────────────→│
  │                        [File Deleted]←─────────┤
  │                        [Delete Record]─────────→│
  │                              ❌ FAIL          │
  │                        [Rollback]─────────────┤
  │←──[Error: Delete Failed]                      │
  │                     │                         │
  │                   ❌Gone                   ✅Still
  │                                            Exists
  │                                               │
  │                    [Run Cleanup Script]───────┤
  │                    [Delete Orphaned Record]   │
  
RESULT: ⚠️ Orphaned record (very rare)
        ✅ Cleanup script resolves it
```

## 📊 State Consistency Matrix

```
┌───────────────┬──────────┬──────────┬────────────┐
│   Operation   │    S3    │ Database │ Consistent │
├───────────────┼──────────┼──────────┼────────────┤
│ Upload Start  │   ❌      │   ❌      │     ✅      │
│ S3 Upload     │   ✅      │   ❌      │     ✅      │
│ Processing    │   ✅      │   ⏳      │     ✅      │
│ Complete      │   ✅      │   ✅      │     ✅      │
│ Failed        │   ❌      │   ❌      │     ✅      │
├───────────────┼──────────┼──────────┼────────────┤
│ Delete Start  │   ✅      │   ✅      │     ✅      │
│ S3 Deleted    │   ❌      │   ⏳      │     ✅      │
│ Complete      │   ❌      │   ❌      │     ✅      │
│ S3 Failed     │   ✅      │   ✅      │     ✅      │
│ DB Failed*    │   ❌      │   ✅      │     ⚠️      │
└───────────────┴──────────┴──────────┴────────────┘

* Rare case - cleanup script available
```

## 🎯 Summary

### Upload: S3 First → DB Transaction
```
S3 Upload → Process → [Transaction: Update DB] → Commit
                                               ↓
                                        Rollback + S3 Cleanup
```

### Delete: Transaction → S3 First → DB
```
[Transaction: S3 Delete] → Success → [DB Delete] → Commit
                        ↓
                     Rollback (DB unchanged)
```

### Key Principle
**Operations are atomic within their scope:**
- Upload: DB changes are transactional
- Delete: DB changes are transactional
- S3 operations are all-or-nothing (but not transactional)
- On failure: Clean up everything to maintain consistency

---

**Legend:**
- ✅ Operation succeeded / Consistent state
- ❌ Operation failed / Resource deleted
- ⏳ Operation in progress
- ⚠️ Rare inconsistency (cleanup available)

