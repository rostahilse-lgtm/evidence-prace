// KONTROLA.JS - Kontrola migrace dat mezi "záznamy" (nová appka) a "záznamy_historie" (stará appka)
// v2026-08-08 - NOVÝ SOUBOR
//             - read-only přehled: pro každého pracovníka a den ukáže hodiny z obou zdrojů
//             - červeně zvýrazní dny, kde existuje záznam v OBOU listech zároveň (konflikt)
//             - nic nemaže, nic nepřepisuje - jen čte a zobrazuje pro kontrolu
//             - používá source: 'all' v getallrecords, který už kod.gs podporuje beze změn

window.app.component('kontrola-component', {
  props: [],
  emits: ['message'],

  data() {
    return {
      loading: false,
      rows: [],
      filterOnlyConflicts: true
    }
  },

  computed: {
    filteredRows() {
      return this.filterOnlyConflicts
        ? this.rows.filter(r => r.newHours > 0 && r.histHours > 0)
        : this.rows;
    },
    totalConflicts() {
      return this.rows.filter(r => r.newHours > 0 && r.histHours > 0).length;
    },
    totalOnlyNew() {
      return this.rows.filter(r => r.newHours > 0 && r.histHours === 0).length;
    },
    totalOnlyHist() {
      return this.rows.filter(r => r.histHours > 0 && r.newHours === 0).length;
    }
  },

  methods: {
    async loadData() {
      this.loading = true;
      try {
        const res = await apiCall('getallrecords', { source: 'all' });
        if (res.code !== '000' || !res.data) {
          this.$emit('message', 'Chyba načítání dat: ' + (res.error || ''));
          this.loading = false;
          return;
        }
        const map = {};
        res.data.forEach(r => {
          const workerId = String(r[1]);
          const workerName = r[6] || '?';
          const ts = Number(r[4]);
          if (!ts) return;
          const d = new Date(ts);
          const dateKey = String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear();
          const key = workerId + '|' + dateKey;
          if (!map[key]) {
            map[key] = {
              workerId, workerName, dateKey,
              dateTs: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
              newHours: 0, histHours: 0, newCount: 0, histCount: 0
            };
          }
          const hours = parseFloat(r[7]) || 0;
          const source = r[18]; // 'záznamy' nebo 'záznamy_historie'
          if (source === 'záznamy_historie') {
            map[key].histHours += hours;
            map[key].histCount++;
          } else {
            map[key].newHours += hours;
            map[key].newCount++;
          }
        });
        this.rows = Object.values(map).sort((a, b) =>
          b.dateTs - a.dateTs || a.workerName.localeCompare(b.workerName, 'cs')
        );
      } catch (e) {
        this.$emit('message', 'Chyba při načítání dat');
      }
      this.loading = false;
    }
  },

  mounted() {
    this.loadData();
  },

  template: `
    <div class="q-pt-sm">
      <div class="q-mb-sm q-pa-xs text-caption text-blue-8" style="background:#e3f2fd;border-radius:4px">
        ℹ Porovnání podle pracovníka a dne mezi listem "záznamy" (nová appka) a "záznamy_historie" (stará appka).
        Data se pouze čtou — nic se nemaže ani nepřepisuje.
      </div>

      <div class="row q-gutter-sm q-mb-sm">
        <div class="q-pa-xs text-caption" style="background:#ffebee;border-radius:4px">🔴 Konflikty: {{ totalConflicts }}</div>
        <div class="q-pa-xs text-caption" style="background:#e8f5e9;border-radius:4px">🟢 Jen nová: {{ totalOnlyNew }}</div>
        <div class="q-pa-xs text-caption" style="background:#fff3e0;border-radius:4px">🟡 Jen historie: {{ totalOnlyHist }}</div>
      </div>

      <div class="row items-center q-mb-sm">
        <q-checkbox v-model="filterOnlyConflicts" label="Zobrazit jen konflikty (oba zdroje zároveň)"/>
        <q-space/>
        <q-btn flat dense icon="refresh" @click="loadData" :loading="loading"/>
      </div>

      <div v-if="loading" class="text-center q-pa-md"><q-spinner color="primary" size="2em"/></div>
      <div v-else-if="filteredRows.length === 0" class="text-center text-grey-7 q-mt-lg">
        {{ filterOnlyConflicts ? '✓ Žádné konflikty' : 'Žádné záznamy k zobrazení' }}
      </div>
      <div v-else>
        <div v-for="row in filteredRows" :key="row.workerId + row.dateKey"
          class="record-card"
          :style="(row.newHours > 0 && row.histHours > 0) ? 'border-left:4px solid #e53935' : ''">
          <div class="row items-center no-wrap">
            <div class="col">
              <div class="text-bold">{{ row.workerName }}</div>
              <div class="text-caption text-grey-7">{{ row.dateKey }}</div>
            </div>
            <div class="q-mr-md text-right" style="min-width:90px">
              <div class="text-caption text-grey-6">Nová appka</div>
              <div :class="row.newHours > 0 ? 'text-bold text-green-8' : 'text-grey-4'">{{ row.newHours.toFixed(2) }} h</div>
            </div>
            <div class="text-right" style="min-width:90px">
              <div class="text-caption text-grey-6">Historie</div>
              <div :class="row.histHours > 0 ? 'text-bold text-orange-8' : 'text-grey-4'">{{ row.histHours.toFixed(2) }} h</div>
            </div>
          </div>
          <div v-if="row.newHours > 0 && row.histHours > 0" class="text-caption text-red-8 q-mt-xs">
            ⚠ Záznam existuje v OBOU listech tento den — zkontroluj v Google Sheetu a případně jeden smaž ručně.
          </div>
        </div>
      </div>
    </div>
  `
});
