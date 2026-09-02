# Import im Hintergrund mit Benachrichtigung — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teilen löst den Import nur noch aus; die App schließt sich sofort. Ein Worker verfolgt den Job und meldet lokal auf genau dem Gerät, das geteilt hat. Erst das Abnicken in der Vorschau schreibt das Rezept in die Datenbank.

**Architecture:** Der Server bleibt beim reinen Extrahieren und bekommt eine serielle Warteschlange plus längere Haltezeit. In der App zerfällt `DashboardClient.parse` in Starten und Pollen; das Pollen wandert in einen `ImportStatusWorker` (WorkManager), der den fertigen Entwurf **lokal ablegt** und dann benachrichtigt. `ShareActivity` bekommt zwei Einstiege: einen Share-Intent (feuern und schließen) und eine Job-Id aus der Benachrichtigung (Vorschau öffnen).

**Tech Stack:** Next.js 16 (App Router), Vitest; Kotlin/Jetpack Compose, OkHttp, WorkManager, MockWebServer, JUnit4.

**Spec:** `docs/superpowers/specs/2026-09-02-import-im-hintergrund-mit-benachrichtigung-design.md`

## Global Constraints

- **Zwei Repos.** Dashboard: `C:\Users\ThinkPad\Documents\Claude\Dashboard`. App: `C:\Users\ThinkPad\Documents\Claude\Rezept-Importer`. Beide stehen auf `main`; für diese Arbeit in beiden einen Branch `import-hintergrund` anlegen. **Nicht auf `main` arbeiten.**
- **Der Serververtrag ändert sich nicht.** `POST /api/recipes/parse` (mit `async`) und `GET /api/recipes/parse?job=` behalten Felder, Statuswerte und Statuscodes. Es wird weiterhin **nie** ungefragt gespeichert.
- **Sprache:** Kommentare, Commit-Nachrichten und UI-Texte deutsch. Code-Bezeichner englisch.
- **Dashboard-Tests:** `cd web && node_modules/.bin/vitest run <datei>`. Der Flag `--reporter=basic` existiert in dieser Vitest-Version nicht und lässt den Lauf mit `ERR_LOAD_URL` scheitern — weglassen.
- **Android-Tests:** `cd android && ./gradlew :app:testDebugUnitTest --console=plain`. Meldet Gradle `UP-TO-DATE`, ist nichts gelaufen — dann `--rerun` anhängen.
- **In den Dashboard-Repository-Tests wird der Prisma-Client immer explizit übergeben.** Ohne ihn schreiben Tests in die echte `dev.db` statt in die isolierte Test-DB.
- **`assertFailsWith` aus `kotlin.test` gibt es in der App nicht** (nur JUnit4) — das vorhandene `runCatching { }.exceptionOrNull()`-Muster nehmen.
- **Nach jedem Task committen.** Kein Push, kein Deploy, kein APK-Bau — alles gesammelt in Task 6.

---

### Task 1: Serielle Warteschlange und längere Haltezeit

**Files:**
- Modify: `web/src/lib/services/importJobs.ts`
- Modify: `web/src/app/api/recipes/parse/route.ts` (der `async`-Zweig)
- Test: `web/src/lib/services/importJobs.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `enqueue(task: () => Promise<void>): void` aus `importJobs.ts`; `JOB_TTL_MS` steigt auf `3_600_000`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `web/src/lib/services/importJobs.test.ts` ans Ende:

```ts
describe("enqueue", () => {
  it("laesst immer nur eine Aufgabe gleichzeitig laufen", async () => {
    let laufend = 0;
    let gleichzeitigMax = 0;
    const lauf = () => async () => {
      laufend++;
      gleichzeitigMax = Math.max(gleichzeitigMax, laufend);
      await new Promise((r) => setTimeout(r, 10));
      laufend--;
    };

    enqueue(lauf());
    enqueue(lauf());
    enqueue(lauf());
    await new Promise((r) => setTimeout(r, 100));

    expect(gleichzeitigMax).toBe(1);
  });

  it("laesst einen Fehlschlag die Warteschlange nicht anhalten", async () => {
    const gelaufen: string[] = [];
    enqueue(async () => {
      throw new Error("kaputt");
    });
    enqueue(async () => {
      gelaufen.push("zweite");
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(gelaufen).toEqual(["zweite"]);
  });

  it("haelt Jobs eine Stunde", () => {
    expect(JOB_TTL_MS).toBe(3_600_000);
  });
});
```

`enqueue` mit in den Import der Datei aufnehmen.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/importJobs.test.ts
```

Erwartet: FAIL — `enqueue` existiert nicht, `JOB_TTL_MS` ist 600_000.

- [ ] **Step 3: Warteschlange und Haltezeit einbauen**

In `web/src/lib/services/importJobs.ts`:

```ts
/**
 * Nach dieser Zeit wird ein Job vergessen, fertig oder nicht. Eine Stunde, weil
 * zwischen dem Fertigwerden und dem Antippen der Benachrichtigung auf dem Handy
 * beliebig viel Zeit liegen kann.
 */
export const JOB_TTL_MS = 3_600_000;

/**
 * Extraktionen laufen nacheinander, nie parallel. Ein `claude`-Prozess wiegt
 * ~126 MB; das Tablet hat 7,4 GB RAM, davon 2,2 GB frei, und swappt bereits zu
 * 80 %. `next-server` ist mit 194 MB der größte Prozess und damit erster
 * Kandidat, wenn Android unter Druck aufräumt. Angenommen wird trotzdem sofort
 * (die Route antwortet mit 202) — nur die Arbeit reiht sich ein.
 */
let queue: Promise<void> = Promise.resolve();

export function enqueue(task: () => Promise<void>): void {
  // `catch` in der Kette, nicht am Aufrufer: ein gescheiterter Job darf die
  // Warteschlange nicht anhalten — er hat seinen Fehler ohnehin schon im Job
  // vermerkt.
  queue = queue.then(task).catch(() => {});
}
```

- [ ] **Step 4: Die Route die Warteschlange nutzen lassen**

In `web/src/app/api/recipes/parse/route.ts` im `async`-Zweig `void runExtraction(...)` ersetzen durch:

```ts
    enqueue(() => runExtraction(jobId, text, sourceUrl));
```

`enqueue` mit importieren. `runExtraction` selbst bleibt unverändert — sie wirft ohnehin nie.

- [ ] **Step 5: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/importJobs.test.ts src/app/api/recipes/parse/route.test.ts
```

Erwartet: PASS. Die Routen-Tests warten bisher mit `await new Promise((r) => setTimeout(r, 0))` auf den Hintergrundlauf; durch die Warteschlange kommt eine Microtask-Ebene dazu. Schlägt einer davon fehl, die Wartezeile dort auf `setTimeout(r, 20)` heraufsetzen — **nicht** die Zusicherungen abschwächen.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/services/importJobs.ts web/src/lib/services/importJobs.test.ts web/src/app/api/recipes/parse/route.ts web/src/app/api/recipes/parse/route.test.ts
git commit -m "feat(rezepte): Extraktionen laufen seriell, Jobs halten eine Stunde"
```

---

### Task 2: Entwürfe je Job ablegen

Ab hier im Repo `Rezept-Importer`. Zuerst `git checkout -b import-hintergrund`.

Heute liegt genau ein Entwurf unter dem Schlüssel `draft_json` in den SharedPreferences. Mit mehreren gleichzeitigen Importen überschreiben sich zwei Entwürfe gegenseitig — ein Fehler, der erst auffällt, wenn ein Rezept schon weg ist.

**Files:**
- Create: `android/app/src/main/java/de/dml/rezeptimporter/draft/DraftStore.kt`
- Test: `android/app/src/test/java/de/dml/rezeptimporter/draft/DraftStoreTest.kt`

**Interfaces:**
- Consumes: `RecipeDraft` aus `de.dml.rezeptimporter.domain`.
- Produces:
  - `class DraftStore(private val prefs: SharedPreferences)`
  - `fun put(jobId: String, draft: RecipeDraft)`
  - `fun get(jobId: String): RecipeDraft?`
  - `fun remove(jobId: String)`
  - `fun sweep(now: Long = System.currentTimeMillis())`
  - `const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`android/app/src/test/java/de/dml/rezeptimporter/draft/DraftStoreTest.kt`. Robolectric gibt es hier nicht; die Tests laufen gegen eine kleine `SharedPreferences`-Attrappe im Speicher — die reicht, weil `DraftStore` nur `getString`/`putString`/`remove`/`all` benutzt:

```kotlin
package de.dml.rezeptimporter.draft

import android.content.SharedPreferences
import de.dml.rezeptimporter.domain.RecipeDraft
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Minimale In-Memory-SharedPreferences; nur die vier von DraftStore genutzten Wege. */
private class FakePrefs : SharedPreferences {
    val values = mutableMapOf<String, String>()

    override fun getString(key: String?, defValue: String?): String? = values[key] ?: defValue
    override fun getAll(): MutableMap<String, *> = values
    override fun contains(key: String?): Boolean = values.containsKey(key)
    override fun edit(): SharedPreferences.Editor = FakeEditor(values)

    override fun getStringSet(k: String?, d: MutableSet<String>?) = d
    override fun getInt(k: String?, d: Int) = d
    override fun getLong(k: String?, d: Long) = d
    override fun getFloat(k: String?, d: Float) = d
    override fun getBoolean(k: String?, d: Boolean) = d
    override fun registerOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    override fun unregisterOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}
}

private class FakeEditor(private val values: MutableMap<String, String>) : SharedPreferences.Editor {
    override fun putString(key: String?, value: String?): SharedPreferences.Editor {
        if (key != null && value != null) values[key] = value
        return this
    }
    override fun remove(key: String?): SharedPreferences.Editor {
        values.remove(key); return this
    }
    override fun clear(): SharedPreferences.Editor { values.clear(); return this }
    override fun apply() {}
    override fun commit(): Boolean = true

    override fun putStringSet(k: String?, v: MutableSet<String>?) = this
    override fun putInt(k: String?, v: Int) = this
    override fun putLong(k: String?, v: Long) = this
    override fun putFloat(k: String?, v: Float) = this
    override fun putBoolean(k: String?, v: Boolean) = this
}

class DraftStoreTest {

    private val prefs = FakePrefs()
    private val store = DraftStore(prefs)
    private val draft = RecipeDraft(name = "Linsen-Dal")

    @Test
    fun `legt ab und liest zurueck`() {
        store.put("job-1", draft)
        assertEquals("Linsen-Dal", store.get("job-1")?.name)
    }

    @Test
    fun `zwei Jobs ueberschreiben sich nicht`() {
        store.put("job-1", draft)
        store.put("job-2", draft.copy(name = "Kekse"))

        assertEquals("Linsen-Dal", store.get("job-1")?.name)
        assertEquals("Kekse", store.get("job-2")?.name)
    }

    @Test
    fun `kennt unbekannte Jobs nicht`() {
        assertNull(store.get("gibtsnicht"))
    }

    @Test
    fun `remove trifft nur den einen Eintrag`() {
        store.put("job-1", draft)
        store.put("job-2", draft)
        store.remove("job-1")

        assertNull(store.get("job-1"))
        assertEquals("Linsen-Dal", store.get("job-2")?.name)
    }

    @Test
    fun `sweep entfernt Alte und laesst Junge stehen`() {
        store.put("alt", draft)
        store.put("jung", draft)
        // "alt" kuenstlich altern lassen: Eintrag mit altem Zeitstempel neu schreiben.
        prefs.values["draft_alt"] = prefs.values["draft_alt"]!!.replace(
            Regex("\"savedAt\":\\d+"), "\"savedAt\":1",
        )

        store.sweep(now = MAX_AGE_MS + 2)

        assertNull(store.get("alt"))
        assertEquals("Linsen-Dal", store.get("jung")?.name)
    }

    @Test
    fun `kaputter Eintrag liefert null statt zu werfen`() {
        prefs.values["draft_kaputt"] = "{kein json"
        assertNull(store.get("kaputt"))
    }
}
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain
```

Erwartet: Kompilierfehler — `DraftStore` existiert nicht.

- [ ] **Step 3: `DraftStore` schreiben**

`android/app/src/main/java/de/dml/rezeptimporter/draft/DraftStore.kt`:

```kotlin
package de.dml.rezeptimporter.draft

import android.content.SharedPreferences
import de.dml.rezeptimporter.domain.RecipeDraft
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Nach dieser Zeit räumt `sweep` einen nie abgenickten Entwurf weg. */
const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000

private const val PREFIX = "draft_"

/** Entwurf plus Ablagezeitpunkt — der Zeitstempel treibt `sweep`. */
@Serializable
private data class StoredDraft(val savedAt: Long, val draft: RecipeDraft)

/**
 * Entwürfe je Import-Job. Bewusst ein Schlüssel pro Job: mit dem früheren
 * einzelnen `draft_json` hätten sich zwei gleichzeitige Importe gegenseitig
 * überschrieben, und das fällt erst auf, wenn ein Rezept schon weg ist.
 */
class DraftStore(private val prefs: SharedPreferences) {

    fun put(jobId: String, draft: RecipeDraft) {
        val stored = StoredDraft(System.currentTimeMillis(), draft)
        prefs.edit()
            .putString(PREFIX + jobId, Json.encodeToString(StoredDraft.serializer(), stored))
            .apply()
    }

    /** `null`, wenn es den Job nicht gibt oder der Eintrag unlesbar ist — nie eine Exception. */
    fun get(jobId: String): RecipeDraft? {
        val raw = prefs.getString(PREFIX + jobId, null) ?: return null
        return runCatching { Json.decodeFromString(StoredDraft.serializer(), raw).draft }.getOrNull()
    }

    fun remove(jobId: String) {
        prefs.edit().remove(PREFIX + jobId).apply()
    }

    /**
     * Wirft Entwürfe weg, die älter als [MAX_AGE_MS] sind. Ohne das wächst der
     * Speicher mit jedem Import, den niemand je abnickt. Unlesbare Einträge
     * fliegen gleich mit raus.
     */
    fun sweep(now: Long = System.currentTimeMillis()) {
        val editor = prefs.edit()
        for ((key, value) in prefs.all) {
            if (!key.startsWith(PREFIX)) continue
            val savedAt = runCatching {
                Json.decodeFromString(StoredDraft.serializer(), value as String).savedAt
            }.getOrNull()
            if (savedAt == null || now - savedAt > MAX_AGE_MS) editor.remove(key)
        }
        editor.apply()
    }
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain --rerun
```

Erwartet: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/de/dml/rezeptimporter/draft/DraftStore.kt android/app/src/test/java/de/dml/rezeptimporter/draft/DraftStoreTest.kt
git commit -m "feat: Entwuerfe je Import-Job ablegen statt in einem Schluessel"
```

---

### Task 3: `DashboardClient` in Starten und Pollen zerlegen

`parse` macht heute beides in einem Aufruf. Das geht nicht mehr auf, wenn das Starten in der Activity und das Pollen im Worker sitzt.

**Files:**
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/dashboard/DashboardClient.kt`
- Test: `android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt`

**Interfaces:**
- Consumes: nichts Neues.
- Produces:
  - `sealed interface StartResult { data class Started(val jobId: String) : StartResult; data class Immediate(val draft: RecipeDraft) : StartResult }`
  - `sealed interface JobResult { data object Pending : JobResult; data class Done(val draft: RecipeDraft) : JobResult; data class Failed(val message: String) : JobResult; data object Gone : JobResult }`
  - `suspend fun startParse(text: String, sourceUrl: String?): StartResult`
  - `suspend fun pollJob(jobId: String): JobResult`
  - `save(draft)` bleibt unverändert.

`MAX_POLL_MS` und der Konstruktor-Parameter `pollDelayMs` entfallen ersatzlos — ohne Warteschleife im Client gibt es nichts mehr zu deckeln oder zu verzögern.

**`Immediate` nicht wegkürzen:** ein Server ohne asynchronen Modus ignoriert `async` und liefert das Rezept direkt in der Startantwort. Ohne diesen Zweig verbrennt jeder Rollback nach einer APK-Installation ein Abo-Kontingent für nichts.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `DashboardClientTest.kt` die bisherigen `parse`-Tests durch diese ersetzen (die Testhilfe `client(server)` verliert dabei ihr `pollDelayMs`-Argument):

```kotlin
@Test
fun `startParse gibt die Job-Id zurueck und schickt async`() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(202).setBody("""{"ok":true,"jobId":"j1"}"""))

    val result = client(server).startParse("roher text", null)

    assertEquals(StartResult.Started("j1"), result)
    val request = server.takeRequest()
    assertEquals("POST", request.method)
    assertTrue(request.body.readUtf8().contains("\"async\":true"))
}

@Test
fun `startParse nimmt ein direkt geliefertes Rezept an`() = runBlocking {
    server.enqueue(
        MockResponse().setBody("""{"ok":true,"recipe":{"name":"Dal","steps":[],"ingredients":[]}}""")
    )

    val result = client(server).startParse("x", null)

    assertTrue(result is StartResult.Immediate)
    assertEquals("Dal", (result as StartResult.Immediate).draft.name)
    assertEquals(1, server.requestCount)
}

@Test
fun `startParse wirft ohne Job-Id und ohne Rezept`() = runBlocking {
    server.enqueue(MockResponse().setBody("""{"ok":true}"""))

    val e = runCatching { client(server).startParse("x", null) }.exceptionOrNull()

    assertTrue(e is DashboardException)
}

@Test
fun `pollJob meldet pending, done, error und weg`() = runBlocking {
    val c = client(server)

    server.enqueue(MockResponse().setBody("""{"ok":true,"status":"pending"}"""))
    assertEquals(JobResult.Pending, c.pollJob("j1"))

    server.enqueue(
        MockResponse().setBody("""{"ok":true,"status":"done","recipe":{"name":"Dal","steps":[],"ingredients":[]}}""")
    )
    assertEquals("Dal", (c.pollJob("j1") as JobResult.Done).draft.name)

    server.enqueue(MockResponse().setBody("""{"ok":true,"status":"error","error":"kein Rezept"}"""))
    assertEquals("kein Rezept", (c.pollJob("j1") as JobResult.Failed).message)

    server.enqueue(MockResponse().setResponseCode(404).setBody("""{"ok":false,"error":"weg"}"""))
    assertEquals(JobResult.Gone, c.pollJob("j1"))
}

@Test
fun `pollJob haengt die Job-Id an die Adresse`() = runBlocking {
    server.enqueue(MockResponse().setBody("""{"ok":true,"status":"pending"}"""))

    client(server).pollJob("j-42")

    assertTrue(server.takeRequest().path!!.contains("job=j-42"))
}
```

Die bestehenden Tests zu Headern, `save` und dem `imageUrl`-Roundtrip bleiben; wo sie bisher `parse` riefen, rufen sie jetzt `startParse` und `pollJob` nacheinander.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain --rerun
```

Erwartet: Kompilierfehler — `startParse`, `pollJob`, `StartResult`, `JobResult` fehlen.

- [ ] **Step 3: Umbauen**

In `DashboardClient.kt` `MAX_POLL_MS` und den Parameter `pollDelayMs` löschen, `parse` durch diese beiden Methoden ersetzen (Rest der Datei unverändert):

```kotlin
/** Ergebnis des Job-Starts. `Immediate` deckt Server ohne asynchronen Modus ab. */
sealed interface StartResult {
    data class Started(val jobId: String) : StartResult
    data class Immediate(val draft: RecipeDraft) : StartResult
}

/** Stand eines laufenden Imports — eine Momentaufnahme, kein Warten. */
sealed interface JobResult {
    data object Pending : JobResult
    data class Done(val draft: RecipeDraft) : JobResult
    data class Failed(val message: String) : JobResult
    data object Gone : JobResult
}
```

```kotlin
    /** Startet die Extraktion. Das Warten übernimmt der Worker, nicht der Client. */
    suspend fun startParse(text: String, sourceUrl: String?): StartResult =
        withContext(Dispatchers.IO) {
            val start = post("/api/recipes/parse", buildJsonObject {
                put("text", text)
                put("sourceUrl", sourceUrl)
                put("async", true)
            })
            start["jobId"]?.jsonPrimitive?.contentOrNull?.let {
                return@withContext StartResult.Started(it)
            }
            // Server ohne asynchronen Modus: liefert das Rezept direkt. Nicht
            // wegkürzen — sonst verbrennt jeder Rollback nach einer
            // APK-Installation ein Abo-Kontingent für nichts.
            val recipe = start["recipe"]?.jsonObject
                ?: throw DashboardException("Antwort ohne Job-Id")
            StartResult.Immediate(toDraft(recipe))
        }

    /** Ein einzelner Blick auf den Job. Wiederholen ist Sache des Aufrufers. */
    suspend fun pollJob(jobId: String): JobResult = withContext(Dispatchers.IO) {
        val job = try {
            get("/api/recipes/parse?job=$jobId")
        } catch (e: DashboardException) {
            // Der Server meldet einen abgelaufenen Job als 404, und `execute`
            // macht daraus eine Exception. Hier ist das kein Fehler, sondern ein
            // Zustand.
            if (e.message?.contains("404") == true ||
                e.message?.contains("abgelaufen") == true
            ) return@withContext JobResult.Gone
            throw e
        }
        when (job["status"]?.jsonPrimitive?.contentOrNull) {
            "done" -> JobResult.Done(
                toDraft(job["recipe"]?.jsonObject ?: throw DashboardException("Antwort ohne Rezept"))
            )
            "error" -> JobResult.Failed(
                job["error"]?.jsonPrimitive?.contentOrNull ?: "Import fehlgeschlagen."
            )
            else -> JobResult.Pending
        }
    }
```

**Prüfe beim Umbau nach**, welchen Text `execute` bei einem 404 erzeugt, und passe die Erkennung in `pollJob` daran an — die beiden `contains` oben sind eine Annahme, kein Beleg. Ist die Meldung anders, gib `execute` stattdessen den Statuscode mit heraus, statt auf Text zu prüfen.

- [ ] **Step 4: Tests laufen lassen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain --rerun
```

`ShareActivity` ruft noch `parse` — der Compiler zeigt es. Für diesen Task genügt die kleinstmögliche Anpassung dort: `startParse` aufrufen und bei `Started` in einer Schleife `pollJob` pollen, damit das Verhalten unverändert bleibt. Task 5 wirft diese Schleife wieder weg.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/de/dml/rezeptimporter/dashboard/DashboardClient.kt android/app/src/main/java/de/dml/rezeptimporter/ui/ShareActivity.kt android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt
git commit -m "refactor: DashboardClient trennt Job starten und Job abfragen"
```

---

### Task 4: Worker und Benachrichtigung

**Files:**
- Modify: `android/app/build.gradle.kts` (Abhängigkeit)
- Modify: `android/app/src/main/AndroidManifest.xml` (Berechtigung)
- Create: `android/app/src/main/java/de/dml/rezeptimporter/notify/ImportNotifier.kt`
- Create: `android/app/src/main/java/de/dml/rezeptimporter/work/ImportStatusWorker.kt`
- Test: `android/app/src/test/java/de/dml/rezeptimporter/work/ImportStatusWorkerTest.kt`

**Interfaces:**
- Consumes: `DraftStore` (Task 2), `DashboardClient.pollJob`/`JobResult` (Task 3).
- Produces:
  - `interface ImportNotifier { fun done(jobId: String, name: String); fun failed(jobId: String, reason: String); fun unclear(jobId: String) }`
  - `class AndroidNotifier(private val context: Context) : ImportNotifier`
  - `class ImportStatusWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params)`
  - `ImportStatusWorker.enqueue(context: Context, jobId: String, settings: AppSettings)`
  - Eingabeschlüssel: `job_id`, `base_url`, `token`, `cf_id`, `cf_secret`

- [ ] **Step 1: Abhängigkeit und Berechtigung eintragen**

In `android/app/build.gradle.kts` in den `dependencies`-Block, zu den anderen `androidx`-Zeilen:

```kotlin
    implementation("androidx.work:work-runtime-ktx:2.11.2")
```

(Aktuellste stabile Fassung laut Googles Maven-Metadaten, am 2026-09-02 geprüft; verlangt `compileSdk 35`, das Projekt steht darauf.)

In `android/app/src/main/AndroidManifest.xml` unter die vorhandene Zeile:

```xml
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`android/app/src/test/java/de/dml/rezeptimporter/work/ImportStatusWorkerTest.kt`. Getestet wird die **Entscheidungslogik**, nicht WorkManager selbst — sie liegt dafür in einer eigenen, reinen Funktion:

```kotlin
package de.dml.rezeptimporter.work

import de.dml.rezeptimporter.dashboard.JobResult
import de.dml.rezeptimporter.domain.RecipeDraft
import org.junit.Assert.assertEquals
import org.junit.Test

class ImportOutcomeTest {

    private val draft = RecipeDraft(name = "Linsen-Dal")

    @Test
    fun `fertig meldet den Namen und legt den Entwurf ab`() {
        assertEquals(
            ImportOutcome.Done(draft),
            outcomeOf(JobResult.Done(draft), abgelaufen = false),
        )
    }

    @Test
    fun `fehler reicht die Servermeldung durch`() {
        assertEquals(
            ImportOutcome.Failed("kein Rezept"),
            outcomeOf(JobResult.Failed("kein Rezept"), abgelaufen = false),
        )
    }

    @Test
    fun `weggefallener Job ist unklar`() {
        assertEquals(ImportOutcome.Unclear, outcomeOf(JobResult.Gone, abgelaufen = false))
    }

    @Test
    fun `pending bleibt offen, solange Zeit ist`() {
        assertEquals(ImportOutcome.KeepWaiting, outcomeOf(JobResult.Pending, abgelaufen = false))
    }

    @Test
    fun `pending wird unklar, wenn die Zeit um ist`() {
        assertEquals(ImportOutcome.Unclear, outcomeOf(JobResult.Pending, abgelaufen = true))
    }
}
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain --rerun
```

Erwartet: Kompilierfehler — `outcomeOf` und `ImportOutcome` fehlen.

- [ ] **Step 4: Benachrichtigungen schreiben**

`android/app/src/main/java/de/dml/rezeptimporter/notify/ImportNotifier.kt`:

```kotlin
package de.dml.rezeptimporter.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import de.dml.rezeptimporter.R
import de.dml.rezeptimporter.ui.ShareActivity

/** Hinter dieser Schnittstelle steckt im Test eine Attrappe statt Android. */
interface ImportNotifier {
    fun done(jobId: String, name: String)
    fun failed(jobId: String, reason: String)
    fun unclear(jobId: String)
}

private const val CHANNEL_ID = "import"

class AndroidNotifier(private val context: Context) : ImportNotifier {

    private fun ensureChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Rezept-Import",
            NotificationManager.IMPORTANCE_DEFAULT,
        )
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /**
     * Id aus der Job-Id abgeleitet, damit mehrere Importe nebeneinander stehen
     * bleiben statt sich zu ersetzen.
     */
    private fun show(jobId: String, title: String, text: String, openPreview: Boolean) {
        ensureChannel()
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.obsididine_logo)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)

        if (openPreview) {
            val intent = Intent(context, ShareActivity::class.java)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                .putExtra(ShareActivity.EXTRA_JOB_ID, jobId)
            builder.setContentIntent(
                PendingIntent.getActivity(
                    context,
                    jobId.hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            )
        }

        // Fehlt die Berechtigung, wirft `notify` eine SecurityException. Der Import
        // ist deswegen nicht gescheitert — das Rezept liegt im DraftStore und ist
        // über die App erreichbar. Also schlucken, nicht abstürzen.
        runCatching {
            NotificationManagerCompat.from(context).notify(jobId.hashCode(), builder.build())
        }
    }

    override fun done(jobId: String, name: String) =
        show(jobId, "Rezept fertig: $name", "Antippen zum Prüfen und Speichern", true)

    override fun failed(jobId: String, reason: String) =
        show(jobId, "Import fehlgeschlagen", reason, false)

    override fun unclear(jobId: String) =
        show(jobId, "Import unklar", "Bitte im Cockpit nachsehen oder erneut teilen", false)
}
```

- [ ] **Step 5: Worker schreiben**

`android/app/src/main/java/de/dml/rezeptimporter/work/ImportStatusWorker.kt`:

```kotlin
package de.dml.rezeptimporter.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import de.dml.rezeptimporter.dashboard.DashboardClient
import de.dml.rezeptimporter.dashboard.JobResult
import de.dml.rezeptimporter.domain.RecipeDraft
import de.dml.rezeptimporter.draft.DraftStore
import de.dml.rezeptimporter.notify.AndroidNotifier
import de.dml.rezeptimporter.settings.AppSettings
import kotlinx.coroutines.delay
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** Was nach einem Blick auf den Job zu tun ist. */
sealed interface ImportOutcome {
    data class Done(val draft: RecipeDraft) : ImportOutcome
    data class Failed(val message: String) : ImportOutcome
    data object Unclear : ImportOutcome
    data object KeepWaiting : ImportOutcome
}

/** Reine Entscheidung, getrennt vom Worker, damit sie ohne Android testbar ist. */
fun outcomeOf(job: JobResult, abgelaufen: Boolean): ImportOutcome = when (job) {
    is JobResult.Done -> ImportOutcome.Done(job.draft)
    is JobResult.Failed -> ImportOutcome.Failed(job.message)
    JobResult.Gone -> ImportOutcome.Unclear
    JobResult.Pending -> if (abgelaufen) ImportOutcome.Unclear else ImportOutcome.KeepWaiting
}

private const val POLL_INTERVAL_MS = 5_000L
private const val MAX_WAIT_MS = 300_000L

class ImportStatusWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val jobId = inputData.getString(KEY_JOB_ID) ?: return Result.failure()
        val client = DashboardClient(
            baseUrl = inputData.getString(KEY_BASE_URL).orEmpty(),
            token = inputData.getString(KEY_TOKEN).orEmpty(),
            cfClientId = inputData.getString(KEY_CF_ID).orEmpty(),
            cfClientSecret = inputData.getString(KEY_CF_SECRET).orEmpty(),
            client = OkHttpClient.Builder()
                .callTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build(),
        )
        val drafts = DraftStore(AppSettings(applicationContext).notificationPrefs)
        val notifier = AndroidNotifier(applicationContext)

        val deadline = System.currentTimeMillis() + MAX_WAIT_MS
        while (true) {
            // Ein einzelner fehlgeschlagener Blick (Netz kurz weg, Tunnel zickt)
            // darf den Import nicht abschießen — der Job läuft serverseitig weiter.
            val job = runCatching { client.pollJob(jobId) }.getOrDefault(JobResult.Pending)

            when (val outcome = outcomeOf(job, abgelaufen = System.currentTimeMillis() > deadline)) {
                is ImportOutcome.Done -> {
                    // Erst ablegen, dann melden: danach ist die Benachrichtigung
                    // unabhängig davon, ob der Job auf dem Server noch existiert.
                    drafts.put(jobId, outcome.draft)
                    notifier.done(jobId, outcome.draft.name)
                    return Result.success()
                }
                is ImportOutcome.Failed -> {
                    notifier.failed(jobId, outcome.message)
                    return Result.success()
                }
                ImportOutcome.Unclear -> {
                    notifier.unclear(jobId)
                    return Result.success()
                }
                ImportOutcome.KeepWaiting -> delay(POLL_INTERVAL_MS)
            }
        }
    }

    companion object {
        const val KEY_JOB_ID = "job_id"
        const val KEY_BASE_URL = "base_url"
        const val KEY_TOKEN = "token"
        const val KEY_CF_ID = "cf_id"
        const val KEY_CF_SECRET = "cf_secret"

        fun enqueue(context: Context, jobId: String, settings: AppSettings) {
            val request = OneTimeWorkRequestBuilder<ImportStatusWorker>()
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                )
                .setInputData(
                    Data.Builder()
                        .putString(KEY_JOB_ID, jobId)
                        .putString(KEY_BASE_URL, settings.dashboardUrl)
                        .putString(KEY_TOKEN, settings.importToken)
                        .putString(KEY_CF_ID, settings.cfClientId)
                        .putString(KEY_CF_SECRET, settings.cfClientSecret)
                        .build()
                )
                .build()
            // Eindeutiger Name je Job, sonst fasst WorkManager mehrere Importe
            // zusammen und nur einer wird verfolgt.
            WorkManager.getInstance(context)
                .enqueueUniqueWork("import-$jobId", ExistingWorkPolicy.KEEP, request)
        }
    }
}
```

`AppSettings` braucht dafür einen Zugang zu den Entwurfs-Preferences. Ergänze dort:

```kotlin
    /** Ablage der Import-Entwürfe. Bewusst nicht verschlüsselt: Rezepte sind kein Geheimnis. */
    val notificationPrefs: SharedPreferences
        get() = context.getSharedPreferences("import_draft", Context.MODE_PRIVATE)
```

**Prüfe**, wie `AppSettings` heute an den `Context` kommt, und füge das Feld passend zur bestehenden Bauweise ein — nicht raten.

- [ ] **Step 6: Tests laufen lassen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain --rerun
```

Erwartet: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit**

```bash
git add android/app/build.gradle.kts android/app/src/main/AndroidManifest.xml android/app/src/main/java/de/dml/rezeptimporter/notify/ImportNotifier.kt android/app/src/main/java/de/dml/rezeptimporter/work/ImportStatusWorker.kt android/app/src/main/java/de/dml/rezeptimporter/settings/AppSettings.kt android/app/src/test/java/de/dml/rezeptimporter/work/ImportStatusWorkerTest.kt
git commit -m "feat: Worker verfolgt den Import und meldet ihn lokal"
```

---

### Task 5: Teilen ohne Warten

**Files:**
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/ui/ShareActivity.kt`
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/ui/MainActivity.kt` (Berechtigungsabfrage)
- Test: keiner — `ShareActivity` ist Android-Oberfläche; die Logik dahinter ist in den Tasks 2 bis 4 abgedeckt. Der Nachweis ist der echte Import in Task 6.

**Interfaces:**
- Consumes: alles Vorherige.
- Produces: `ShareActivity.EXTRA_JOB_ID = "job_id"`.

- [ ] **Step 1: Zwei Einstiege in `ShareActivity`**

`ImportState` schrumpft auf `Preview` und `Error` — der `Working`-Zustand samt Sekundenzähler und `ProgressLines` fällt weg.

In `onCreate`:

```kotlin
        val jobId = intent.getStringExtra(EXTRA_JOB_ID)
        if (jobId != null) {
            // Einstieg aus der Benachrichtigung: Entwurf liegt lokal.
            val draft = DraftStore(settings.notificationPrefs).get(jobId)
            state.value = if (draft != null) ImportState.Preview(draft)
            else ImportState.Error("Import abgelaufen — bitte erneut teilen.")
            reviewJobId = jobId
        } else {
            startImport()
        }
```

- [ ] **Step 2: `runImport` durch `startImport` ersetzen**

Kein `lifecycleScope`-Warten mehr, kein Ticker, kein Polling:

```kotlin
    private fun startImport() {
        lifecycleScope.launch {
            try {
                if (settings.dashboardUrl.isBlank() || settings.importToken.isBlank()) {
                    state.value = ImportState.Error(
                        "Dashboard nicht eingerichtet — erst App öffnen, Adresse und Token eintragen."
                    )
                    return@launch
                }
                val source = collectSourceText()
                if (source.isBlank()) {
                    state.value = ImportState.Error(
                        "Kein Text gefunden (OCR leer?). Tipp: Screenshot mit gut lesbarem Text teilen."
                    )
                    return@launch
                }
                val shareUrl = extractShareUrl(source)
                val dashboard = DashboardClient(
                    baseUrl = settings.dashboardUrl,
                    token = settings.importToken,
                    cfClientId = settings.cfClientId,
                    cfClientSecret = settings.cfClientSecret,
                    client = httpClient,
                )
                val socialUrl = shareUrl?.takeIf { LinkHosts.isSocial(it) || LinkHosts.isYouTube(it) }
                val start = when {
                    socialUrl != null ->
                        dashboard.startParse(RecipeLinkResolver(httpClient).resolve(socialUrl), socialUrl)
                    shareUrl != null -> dashboard.startParse("", shareUrl)
                    else -> dashboard.startParse(source, null)
                }

                when (start) {
                    is StartResult.Started -> {
                        ImportStatusWorker.enqueue(this@ShareActivity, start.jobId, settings)
                        DraftStore(settings.notificationPrefs).sweep()
                        Toast.makeText(
                            this@ShareActivity,
                            "An Cockpit übergeben — Benachrichtigung folgt",
                            Toast.LENGTH_SHORT,
                        ).show()
                        finish()
                    }
                    // Alter Server: Rezept ist schon da, direkt in die Vorschau.
                    is StartResult.Immediate -> state.value = ImportState.Preview(start.draft)
                }
            } catch (e: Exception) {
                state.value = ImportState.Error(e.message ?: "Import fehlgeschlagen.")
            }
        }
    }
```

- [ ] **Step 3: Speichern räumt auf**

In `save(draft)` nach dem erfolgreichen `save`-Aufruf, vor `finish()`:

```kotlin
                reviewJobId?.let {
                    DraftStore(settings.notificationPrefs).remove(it)
                    NotificationManagerCompat.from(this@ShareActivity).cancel(it.hashCode())
                }
```

Die bisherige Entwurfs-Persistenz (`persistDraft`, `loadPersistedDraft`, `KEY_DRAFT_PREFS`) fällt ersatzlos weg — `DraftStore` hat sie ersetzt. `onSaveInstanceState` mit `KEY_DRAFT` bleibt: das ist Bildschirmdrehung, nicht Import-Ablage.

- [ ] **Step 4: Berechtigung abfragen**

In `MainActivity` beim Öffnen der Einstellungen einmalig `POST_NOTIFICATIONS` anfragen (nur ab `Build.VERSION_CODES.TIRAMISU`), über `registerForActivityResult(ActivityResultContracts.RequestPermission())`. Wird sie verweigert, in den Einstellungen ein Satz Hinweis: „Ohne Benachrichtigungen läuft der Import trotzdem — das Rezept wartet dann in der App."

Bewusst hier und nicht im Teilen-Ablauf: ein Berechtigungsdialog mitten im Teilen wäre störend.

- [ ] **Step 5: Bauen und Tests**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain --rerun && ./gradlew assembleDebug --console=plain
```

Erwartet: beide `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/de/dml/rezeptimporter/ui/ShareActivity.kt android/app/src/main/java/de/dml/rezeptimporter/ui/MainActivity.kt
git commit -m "feat: Teilen loest den Import nur noch aus"
```

---

### Task 6: Ausrollen und echter Import

**Stopp-Punkt:** Merge, Push und Deploy sind Seiteneffekte außerhalb des Repos. **Vor Step 2 den Nutzer fragen**, nicht selbst entscheiden.

- [ ] **Step 1: Beide Suiten vollständig fahren**

```bash
cd web && node_modules/.bin/vitest run
cd android && ./gradlew :app:testDebugUnitTest --console=plain --rerun
```

Erwartet: beides grün. Meldet Gradle `UP-TO-DATE`, ist nichts gelaufen — dann ist der Nachweis wertlos.

- [ ] **Step 2: Freigabe einholen, dann mergen und pushen**

Beide Branches `import-hintergrund` nach `main`, dann `git push origin main` in beiden Repos.

- [ ] **Step 3: Server ausrollen**

Am Tablet **in einer einzigen SSH-Sitzung** (`ssh -p 8022 u0_a353@192.168.178.91`; abgetrennte Prozesse sterben bei wackligem SSH-Ende):

```
cd ~/haushalts-dashboard && git pull --ff-only
cd web && npm install          # NICHT im Repo-Root, dort liegt keine package.json
npx next build --webpack       # Turbopack hat keine Bindings auf android/arm64
~/restart-dashboard.sh
```

Kein `prisma generate` nötig — dieser Umbau ändert das Schema nicht.

- [ ] **Step 4: Smoke-Tests**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/mobile/meals
```

Beide `200`. Die Startseite allein genügt nicht — sie liest die Rezept-Tabelle gar nicht.

- [ ] **Step 5: Warteschlange am laufenden System prüfen**

Zwei Importe kurz hintereinander starten und mitschreiben, wann sie fertig werden — der zweite darf erst nach dem ersten abschließen:

```bash
TOK=$(grep -oE "^RECIPE_IMPORT_TOKEN=.*" ~/haushalts-dashboard/web/.env | cut -d= -f2-)
for n in 1 2; do
  curl -s http://localhost:3001/api/recipes/parse -X POST \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOK" \
    -d "{\"text\":\"Testrezept $n. 100g Haferflocken, 1 EL Honig. Vermengen und kalt stellen.\",\"async\":true}"
  echo
done
```

Beide Antworten müssen sofort kommen (`202` mit Job-Id). Danach beide Jobs pollen und die Fertigstellungszeiten vergleichen.

- [ ] **Step 6: APK bauen, Signatur prüfen, bereitstellen**

```bash
cd android && ./gradlew assembleDebug --console=plain
"$LOCALAPPDATA/Android/Sdk/build-tools/35.0.0/apksigner.bat" verify --print-certs android/app/build/outputs/apk/debug/app-debug.apk
```

Der SHA-256-Fingerabdruck **muss** `173f3d0995b59883162bc514b92ee589bf21eecb1484f8907471e9938527fbf5` sein. Weicht er ab, ist ein Drüberinstallieren unmöglich und die gespeicherten Zugangsdaten des Nutzers wären verloren — dann **abbrechen und nachfragen**, nicht ausliefern.

Danach per `scp` nach `~/haushalts-dashboard/web/public/obsididine.apk` und die SHA256 beider Dateien vergleichen.

- [ ] **Step 7: Echter Import durch den Nutzer**

Prüfen: Teilen schließt die App sofort; die Benachrichtigung kommt **auf dem teilenden Gerät**; Antippen öffnet die Vorschau mit dem richtigen Rezept; Speichern legt es an und die Benachrichtigung verschwindet. Dann zwei Rezepte kurz hintereinander teilen — beide Benachrichtigungen müssen nebeneinander stehen bleiben und je das richtige Rezept öffnen.

---

## Selbstprüfung des Plans

**Spec-Abdeckung:** Serielle Warteschlange und Haltezeit → Task 1. Aufteilung von `DashboardClient` → Task 3. Worker, Benachrichtigung, Berechtigung, Abhängigkeit → Task 4. Teilen ohne Warten und Einstieg über die Job-Id → Task 5. Entwürfe je Job, Aufräumen, Benachrichtigungs-Ids → Task 2 und 4. Grenzen und Fehlerfälle → Tasks 3 (Gone), 4 (unklar, fehlende Berechtigung), 5 (abgelaufener Entwurf). Mehrere Importe → Tasks 1, 2, 4 und die Probe in Task 6 Step 5 und 7.

**Typkonsistenz:** `JobResult` und `StartResult` entstehen in Task 3 und werden in Task 4 genau so verbraucht. `DraftStore` aus Task 2 wird in Task 4 und 5 mit denselben Signaturen benutzt. `ShareActivity.EXTRA_JOB_ID` entsteht in Task 5 und wird in Task 4 vom `AndroidNotifier` referenziert — **Task 4 muss die Konstante also bereits anlegen**, wenn Task 5 noch nicht gelaufen ist; sie gehört in das `companion object` von `ShareActivity` und wird in Task 4 dort ergänzt.

**Bekannte Annahmen, die der Umsetzer prüfen muss:** die 404-Erkennung in `pollJob` (Task 3, Step 3) und die Bauweise von `AppSettings` für `notificationPrefs` (Task 4, Step 5). Beide sind im Plan als Prüfauftrag markiert, nicht als Tatsache.
