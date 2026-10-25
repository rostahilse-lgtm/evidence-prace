// finance.js
// v2026-10-25 - NOVÝ SOUBOR (jen admin, Nástroje -> Finance). Tři záložky:
//   1) Příjmy / výdaje - zapisování peněz od zákazníka a nákupů (materiál, nafta...) k zakázkám,
//      s filtry a součty. Ukládá se do listu 'finance' (vytvoří se sám).
//   2) Přehled zakázek - po zakázkách: příjmy, výdaje, mzdy (hodiny x sazba zaměstnance ze záznamů),
//      stroje účtované zákazníkovi a orientační zůstatek. Export do CSV (Windows-1250, desetinná čárka).
//   3) Stroje a sazby - které práce jsou stroje/ruka (Bagr, Tatra, Ruka...) a jejich sazba pro zákazníka
//      (Kč/hod). Podle toho se v Domů ukážou tlačítka pro přepnutí a ve Statistikách se spočítá částka.
// Nic stávajícího se nemění, komponenta je samostatná.

window.app.component('finance-component', {
  props: ['contracts', 'jobs', 'currentUser'],
  emits: ['message'],

  data() {
    return {
      tab: 'list',
      loading: false,
      saving: false,
      rows: [],
      machines: [],
      records: [],
      recordsLoaded: false,
      recordsLoading: false,
      form: { id: null, type: 'vydaj', date: '', contractId: null, category: '', amount: null, note: '' },
      flt: { contractId: null, type: null, dateFrom: null, dateTo: null },
      ov: { dateFrom: null, dateTo: null },
      machineForm: { jobId: null, rate: null },
      optSearch: { contract: '', fcontract: '', job: '' }
    };
  },

  computed: {
    contractOptions() { return (this.contracts || []).map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] })); },
    jobOptions() { return (this.jobs || []).map(j => ({ label: j[1], value: String(j[0]) })); },
    contractOptionsFiltered() { return this.filterList(this.contractOptions, this.optSearch.contract); },
    fcontractOptionsFiltered() { return this.filterList(this.contractOptions, this.optSearch.fcontract); },
    jobOptionsFiltered() { return this.filterList(this.jobOptions, this.optSearch.job); },

    categoryOptions() {
      return this.form.type === 'prijem'
        ? ['Platba od zákazníka', 'Záloha od zákazníka', 'Jiný příjem']
        : ['Materiál', 'Pohonné hmoty', 'Subdodavatel', 'Nářadí / stroje', 'Jiný výdaj'];
    },

    filteredRows() {
      const df = this.parseDate(this.flt.dateFrom, false);
      const dt = this.parseDate(this.flt.dateTo, true);
      const cname = this.flt.contractId ? this.norm(this.contractNameById(this.flt.contractId)) : null;
      return this.rows.filter(r => {
        if (this.flt.type && ((this.flt.type === 'prijem') !== (r[2] === 'příjem'))) return false;
        if (cname !== null && this.norm(r[3]) !== cname) return false;
        if (df && r[1] < df) return false;
        if (dt && r[1] > dt) return false;
        return true;
      }).sort((a, b) => b[1] - a[1]);
    },
    sumIncome() { return this.filteredRows.filter(r => r[2] === 'příjem').reduce((s, r) => s + r[5], 0); },
    sumExpense() { return this.filteredRows.filter(r => r[2] === 'výdaj').reduce((s, r) => s + r[5], 0); },

    // Přehled po zakázkách
    overviewRows() {
      const df = this.parseDate(this.ov.dateFrom, false);
      const dt = this.parseDate(this.ov.dateTo, true);
      const map = {};
      const get = (name) => {
        const key = this.norm(name) || '(bez zakázky)';
        if (!map[key]) map[key] = { name: String(name || '').trim() || '(bez zakázky)', income: 0, expense: 0, labor: 0, hours: 0, machineHours: 0, machineAmount: 0 };
        return map[key];
      };
      this.rows.forEach(r => {
        if (df && r[1] < df) return;
        if (dt && r[1] > dt) return;
        const o = get(r[3]);
        if (r[2] === 'příjem') o.income += r[5]; else o.expense += r[5];
      });
      const machineByName = {};
      this.machines.forEach(m => { machineByName[this.norm(m[1])] = Number(m[2]) || 0; });
      this.records.forEach(r => {
        const ts = Number(r[4]);
        if (df && ts < df) return;
        if (dt && ts > dt) return;
        const o = get(r[0]);
        const h = parseFloat(r[7]) || 0;
        o.hours += h;
        o.labor += h * (parseFloat(r[2]) || 0);
        const mk = this.norm(r[3]);
        if (Object.prototype.hasOwnProperty.call(machineByName, mk)) {
          o.machineHours += h;
          o.machineAmount += h * machineByName[mk];
        }
      });
      return Object.values(map)
        .map(o => Object.assign(o, { balance: o.income - o.expense - o.labor }))
        .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    },
    overviewTotal() {
      const t = { income: 0, expense: 0, labor: 0, hours: 0, machineHours: 0, machineAmount: 0, balance: 0 };
      this.overviewRows.forEach(o => Object.keys(t).forEach(k => { t[k] += o[k]; }));
      return t;
    }
  },

  methods: {
    norm(t) { return String(t || '').trim().toLowerCase(); },
    normSearch(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); },
    filterList(all, val) { const n = this.normSearch(val); return n === '' ? all : all.filter(o => this.normSearch(o.label).includes(n)); },
    filterBy(val, update, key) { update(() => { this.optSearch[key] = val || ''; }); },
    filterContracts(val, update) { this.filterBy(val, update, 'contract'); },
    filterFContracts(val, update) { this.filterBy(val, update, 'fcontract'); },
    filterJobs(val, update) { this.filterBy(val, update, 'job'); },

    contractNameById(id) {
      const c = (this.contracts || []).find(x => String(x[0]) === String(id));
      return c ? c[1] : '';
    },
    contractIdByName(name) {
      const c = (this.contracts || []).find(x => this.norm(x[1]) === this.norm(name));
      return c ? c[0] : null;
    },

    todayStr() {
      const d = new Date();
      return String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear();
    },
    dateToMs(str) {
      const p = String(str || '').split('. ');
      if (p.length !== 3) return 0;
      return new Date(p[2], p[1] - 1, p[0], 12, 0).getTime();
    },
    msToDate(ms) {
      const d = new Date(Number(ms));
      return String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear();
    },
    parseDate(str, endOfDay) {
      if (!str) return null;
      const p = String(str).split('. ');
      if (p.length !== 3) return null;
      return endOfDay ? new Date(p[2], p[1] - 1, p[0], 23, 59, 59).getTime() : new Date(p[2], p[1] - 1, p[0], 0, 0, 0).getTime();
    },
    money(n) { return Math.round(Number(n) || 0).toLocaleString('cs-CZ') + ' Kč'; },
    dec(n) { return String(n).replace('.', ','); },

    async loadAll() {
      this.loading = true;
      try {
        const [f, m] = await Promise.all([
          apiCall('getfinance', {}),
          apiCall('get', { type: 'machines' })
        ]);
        if (f.code === '000' && Array.isArray(f.data)) this.rows = f.data;
        else this.$emit('message', 'Finance se nepodařilo načíst' + (f.error ? ': ' + f.error : ' (nahrajte novou verzi kod.gs)'));
        if (m.code === '000' && Array.isArray(m.data)) this.machines = m.data;
      } catch (e) {
        this.$emit('message', 'Chyba při načítání financí');
      }
      this.loading = false;
    },

    async loadRecords() {
      if (this.recordsLoaded || this.recordsLoading) return;
      this.recordsLoading = true;
      try {
        const r = await apiCall('getallrecords', { source: 'all' });
        if (r.code === '000' && Array.isArray(r.data)) { this.records = r.data; this.recordsLoaded = true; }
      } catch (e) {
        this.$emit('message', 'Chyba při načítání záznamů');
      }
      this.recordsLoading = false;
    },

    resetForm() {
      this.form = { id: null, type: this.form.type, date: this.todayStr(), contractId: null, category: '', amount: null, note: '' };
    },

    async save() {
      const f = this.form;
      const amount = Number(String(f.amount).replace(',', '.'));
      if (!(amount > 0)) { this.$emit('message', 'Zadejte částku větší než 0'); return; }
      if (!f.date) { this.$emit('message', 'Zadejte datum'); return; }
      this.saving = true;
      try {
        const params = {
          date: this.dateToMs(f.date),
          type: f.type,
          id_contract: f.contractId || '',
          category: f.category || '',
          amount: amount,
          note: f.note || '',
          id_worker: this.currentUser ? this.currentUser.id : ''
        };
        if (f.id) params.id = f.id;
        const res = await apiCall('savefinance', params);
        if (res.code === '000') {
          this.$emit('message', f.id ? '✓ Záznam upraven' : '✓ Záznam uložen');
          this.resetForm();
          await this.loadAll();
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || 'neznámá'));
        }
      } catch (e) {
        this.$emit('message', 'Chyba připojení, zkuste to znovu');
      }
      this.saving = false;
    },

    edit(r) {
      this.form = {
        id: r[0],
        type: r[2] === 'příjem' ? 'prijem' : 'vydaj',
        date: this.msToDate(r[1]),
        contractId: this.contractIdByName(r[3]),
        category: r[4],
        amount: r[5],
        note: r[6]
      };
      window.scrollTo(0, 0);
    },

    async remove(r) {
      if (!window.confirm('Smazat ' + r[2] + ' ' + this.money(r[5]) + ' (' + this.msToDate(r[1]) + ')?')) return;
      const res = await apiCall('deletefinance', { id: r[0] });
      if (res.code === '000') {
        this.$emit('message', '✓ Smazáno');
        if (this.form.id === r[0]) this.resetForm();
        await this.loadAll();
      } else {
        this.$emit('message', 'Chyba: ' + (res.error || 'neznámá'));
      }
    },

    // --- Stroje a sazby ---
    editMachine(m) {
      this.machineForm = { jobId: String(m[0]), rate: Number(m[2]) || 0 };
      window.scrollTo(0, 0);
    },
    async saveMachine(jobId, rate, active) {
      if (!jobId) { this.$emit('message', 'Vyberte práci'); return; }
      const r = Number(String(rate).replace(',', '.'));
      if (!(r >= 0)) { this.$emit('message', 'Zadejte sazbu (Kč za hodinu)'); return; }
      const res = await apiCall('savemachine', { id_job: jobId, rate: r, active: active });
      if (res.code === '000') {
        this.$emit('message', '✓ Uloženo');
        this.machineForm = { jobId: null, rate: null };
        await this.loadAll();
        this.$emit('message', '✓ Uloženo (tlačítka v Domů se projeví po novém otevření aplikace)');
      } else {
        this.$emit('message', 'Chyba: ' + (res.error || 'neznámá'));
      }
    },

    // --- Export CSV (Windows-1250, desetinná čárka) ---
    downloadCsv(name, csv) {
      const win1250map = {
        'Á':0xC1,'á':0xE1,'Č':0xC8,'č':0xE8,'Ď':0xCF,'ď':0xEF,
        'É':0xC9,'é':0xE9,'Ě':0xCC,'ě':0xEC,'Í':0xCD,'í':0xED,
        'Ň':0xD2,'ň':0xF2,'Ó':0xD3,'ó':0xF3,'Ř':0xD8,'ř':0xF8,
        'Š':0x8A,'š':0x9A,'Ť':0x8D,'ť':0x9D,'Ú':0xDA,'ú':0xFA,
        'Ů':0xD9,'ů':0xF9,'Ý':0xDD,'ý':0xFD,'Ž':0x8E,'ž':0x9E,
        'Ä':0xC4,'ä':0xE4,'Ö':0xD6,'ö':0xF6,'Ü':0xDC,'ü':0xFC,'ß':0xDF,
        '–':0x96,'—':0x97,'„':0x84,'“':0x93,'”':0x94,'’':0x92,'°':0xB0
      };
      const bytes = new Uint8Array(csv.length);
      for (let i = 0; i < csv.length; i++) {
        const ch = csv[i];
        if (win1250map[ch] !== undefined) bytes[i] = win1250map[ch];
        else { const code = csv.charCodeAt(i); bytes[i] = code < 128 ? code : 0x3F; }
      }
      const blob = new Blob([bytes], { type: 'text/csv;charset=windows-1250;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', name);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    q(cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; },

    exportList() {
      if (!this.filteredRows.length) { this.$emit('message', 'Není co exportovat'); return; }
      let csv = 'Datum;Typ;Zakázka;Kategorie;Částka;Poznámka\r\n';
      this.filteredRows.forEach(r => {
        csv += [this.msToDate(r[1]), r[2], r[3], r[4], this.dec(r[5]), r[6]].map(this.q).join(';') + '\r\n';
      });
      csv += '\r\nSOUHRN\r\n';
      csv += 'Příjmy;' + this.dec(this.sumIncome) + '\r\n';
      csv += 'Výdaje;' + this.dec(this.sumExpense) + '\r\n';
      csv += 'Rozdíl;' + this.dec(this.sumIncome - this.sumExpense) + '\r\n';
      this.downloadCsv('finance_' + new Date().getTime() + '.csv', csv);
      this.$emit('message', '✓ Export dokončen');
    },

    exportOverview() {
      if (!this.overviewRows.length) { this.$emit('message', 'Není co exportovat'); return; }
      let csv = 'Zakázka;Příjmy;Výdaje;Mzdy;Zůstatek;Hodiny;Hodiny stroje;Stroje účtováno\r\n';
      const line = (o) => [this.q(o.name), this.dec(Math.round(o.income)), this.dec(Math.round(o.expense)), this.dec(Math.round(o.labor)),
        this.dec(Math.round(o.balance)), this.dec(o.hours.toFixed(2)), this.dec(o.machineHours.toFixed(2)), this.dec(Math.round(o.machineAmount))].join(';');
      this.overviewRows.forEach(o => { csv += line(o) + '\r\n'; });
      csv += line(Object.assign({ name: 'CELKEM' }, this.overviewTotal)) + '\r\n';
      this.downloadCsv('prehled_zakazek_' + new Date().getTime() + '.csv', csv);
      this.$emit('message', '✓ Export dokončen');
    }
  },

  watch: {
    tab(v) { if (v === 'overview') this.loadRecords(); }
  },

  async mounted() {
    this.form.date = this.todayStr();
    await this.loadAll();
  },

  template: `
    <div>
      <q-tabs v-model="tab" dense align="justify" class="text-primary q-mb-md">
        <q-tab name="list" icon="payments" label="Příjmy/výdaje"/>
        <q-tab name="overview" icon="account_balance" label="Přehled"/>
        <q-tab name="machines" icon="agriculture" label="Stroje"/>
      </q-tabs>

      <div v-if="loading" class="text-center q-pa-sm"><q-spinner color="primary" size="1.5em"/></div>

      <!-- PŘÍJMY / VÝDAJE -->
      <div v-if="tab === 'list'">
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">{{ form.id ? '✏️ Oprava záznamu' : '➕ Nový záznam' }}</div>
            <q-btn-toggle v-model="form.type" @update:model-value="form.category = ''" spread no-caps unelevated class="q-mb-sm"
              toggle-color="primary" color="white" text-color="primary"
              :options="[{label: '⬇ Příjem (od zákazníka)', value: 'prijem'}, {label: '⬆ Výdaj (materiál...)', value: 'vydaj'}]"/>
            <q-input v-model="form.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover ref="finDateProxy">
                    <q-date v-model="form.date" mask="DD. MM. YYYY" @update:model-value="$refs.finDateProxy.hide()"/>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-select v-model="form.contractId" :options="contractOptionsFiltered" label="Zakázka (nepovinné)"
              emit-value map-options outlined dense clearable class="q-mb-sm"
              use-input hide-selected fill-input input-debounce="0"
              @filter="filterContracts" @focus="filterContracts('', u => u())"/>
            <q-select v-model="form.category" :options="categoryOptions" label="Kategorie (lze i napsat vlastní)"
              outlined dense class="q-mb-sm" use-input hide-selected fill-input input-debounce="0"
              new-value-mode="add-unique" @input-value="v => { if (v) form.category = v; }"/>
            <q-input v-model.number="form.amount" label="Částka (Kč) *" type="number" outlined dense class="q-mb-sm"/>
            <q-input v-model="form.note" label="Poznámka" outlined dense class="q-mb-sm"/>
            <div class="row q-gutter-sm">
              <q-btn class="col" color="primary" :label="form.id ? 'Uložit změnu' : 'Uložit'" :loading="saving" @click="save"/>
              <q-btn v-if="form.id" class="col" flat color="grey" label="Zrušit úpravu" @click="resetForm"/>
            </div>
          </q-card-section>
        </q-card>

        <div class="text-subtitle2 q-mb-sm">Seznam</div>
        <q-select v-model="flt.contractId" :options="fcontractOptionsFiltered" label="Filtr: zakázka"
          emit-value map-options outlined dense clearable class="q-mb-sm"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterFContracts" @focus="filterFContracts('', u => u())"/>
        <q-select v-model="flt.type" label="Filtr: typ" outlined dense clearable emit-value map-options class="q-mb-sm"
          :options="[{label: 'Příjmy', value: 'prijem'}, {label: 'Výdaje', value: 'vydaj'}]"/>
        <div class="row q-gutter-sm q-mb-sm">
          <q-input class="col" v-model="flt.dateFrom" label="Od" outlined dense readonly clearable>
            <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover><q-date v-model="flt.dateFrom" mask="DD. MM. YYYY"/></q-popup-proxy></q-icon></template>
          </q-input>
          <q-input class="col" v-model="flt.dateTo" label="Do" outlined dense readonly clearable>
            <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover><q-date v-model="flt.dateTo" mask="DD. MM. YYYY"/></q-popup-proxy></q-icon></template>
          </q-input>
        </div>

        <div class="row q-gutter-sm q-mb-sm">
          <div class="col stat-card bg-green-1"><div class="stat-label">Příjmy</div><div class="stat-value text-green">{{ money(sumIncome) }}</div></div>
          <div class="col stat-card bg-red-1"><div class="stat-label">Výdaje</div><div class="stat-value text-red">{{ money(sumExpense) }}</div></div>
          <div class="col stat-card bg-grey-2"><div class="stat-label">Rozdíl</div><div class="stat-value">{{ money(sumIncome - sumExpense) }}</div></div>
        </div>
        <q-btn outline color="green" icon="download" label="Export do CSV" class="full-width q-mb-md" @click="exportList"/>

        <div v-if="!filteredRows.length" class="text-center text-grey-7 q-pa-md">Žádné záznamy</div>
        <div v-for="r in filteredRows" :key="r[0]" class="record-card q-mb-sm">
          <div class="row items-center no-wrap">
            <div class="col">
              <div class="text-bold" :class="r[2] === 'příjem' ? 'text-green-8' : 'text-red-8'">
                {{ r[2] === 'příjem' ? '+' : '−' }}{{ money(r[5]) }}
              </div>
              <div class="text-caption text-grey-7">{{ msToDate(r[1]) }} • {{ r[3] || 'bez zakázky' }} • {{ r[4] || '-' }}</div>
              <div v-if="r[6]" class="text-caption">💬 {{ r[6] }}</div>
            </div>
            <q-btn flat dense round icon="edit" color="primary" @click="edit(r)"/>
            <q-btn flat dense round icon="delete" color="red" @click="remove(r)"/>
          </div>
        </div>
      </div>

      <!-- PŘEHLED -->
      <div v-if="tab === 'overview'">
        <div class="q-mb-sm q-pa-xs text-caption text-blue-8" style="background:#e3f2fd;border-radius:4px">
          ℹ Zůstatek = příjmy − výdaje − mzdy (hodiny × sazba zaměstnance). Částka účtovaná zákazníkovi za práci zaměstnanců
          se zatím nepočítá, "Stroje účtováno" je jen informativně.
        </div>
        <div class="row q-gutter-sm q-mb-sm">
          <q-input class="col" v-model="ov.dateFrom" label="Od" outlined dense readonly clearable>
            <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover><q-date v-model="ov.dateFrom" mask="DD. MM. YYYY"/></q-popup-proxy></q-icon></template>
          </q-input>
          <q-input class="col" v-model="ov.dateTo" label="Do" outlined dense readonly clearable>
            <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover><q-date v-model="ov.dateTo" mask="DD. MM. YYYY"/></q-popup-proxy></q-icon></template>
          </q-input>
        </div>
        <div v-if="recordsLoading" class="text-center q-pa-md"><q-spinner color="primary" size="2em"/><div class="text-grey-7">Načítám záznamy...</div></div>
        <div v-else>
          <q-btn outline color="green" icon="download" label="Export do CSV" class="full-width q-mb-md" @click="exportOverview"/>
          <div v-for="o in overviewRows" :key="o.name" class="record-card q-mb-sm">
            <div class="text-bold">{{ o.name }}</div>
            <div class="row q-col-gutter-xs text-caption q-mt-xs">
              <div class="col-6">Příjmy: <b class="text-green-8">{{ money(o.income) }}</b></div>
              <div class="col-6">Výdaje: <b class="text-red-8">{{ money(o.expense) }}</b></div>
              <div class="col-6">Mzdy: <b>{{ money(o.labor) }}</b> ({{ o.hours.toFixed(1) }} h)</div>
              <div class="col-6">Stroje účtováno: <b>{{ money(o.machineAmount) }}</b> ({{ o.machineHours.toFixed(1) }} h)</div>
            </div>
            <div class="text-subtitle2 q-mt-xs" :class="o.balance >= 0 ? 'text-green-8' : 'text-red-8'">Zůstatek: {{ money(o.balance) }}</div>
          </div>
          <div class="record-card" style="border:2px solid #1976d2">
            <div class="text-bold">CELKEM</div>
            <div class="text-caption">Příjmy {{ money(overviewTotal.income) }} • Výdaje {{ money(overviewTotal.expense) }} • Mzdy {{ money(overviewTotal.labor) }}</div>
            <div class="text-subtitle2" :class="overviewTotal.balance >= 0 ? 'text-green-8' : 'text-red-8'">Zůstatek: {{ money(overviewTotal.balance) }}</div>
          </div>
        </div>
      </div>

      <!-- STROJE A SAZBY -->
      <div v-if="tab === 'machines'">
        <div class="q-mb-sm q-pa-xs text-caption text-blue-8" style="background:#e3f2fd;border-radius:4px">
          ℹ Práce, které jsou stroje nebo ruční práce účtované zákazníkovi zvlášť (např. Bagr, Tatra, Ruka). Práce musí
          nejdřív existovat v seznamu prací. Zaměstnanec má na těchto tlačítkách rychlé přepnutí během směny.
        </div>
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Přidat / změnit sazbu</div>
            <q-select v-model="machineForm.jobId" :options="jobOptionsFiltered" label="Práce *" emit-value map-options
              outlined dense class="q-mb-sm" use-input hide-selected fill-input input-debounce="0"
              @filter="filterJobs" @focus="filterJobs('', u => u())"/>
            <q-input v-model.number="machineForm.rate" label="Sazba pro zákazníka (Kč/hod) *" type="number" outlined dense class="q-mb-sm"/>
            <q-btn color="primary" label="Uložit" class="full-width" @click="saveMachine(machineForm.jobId, machineForm.rate, 'Y')"/>
          </q-card-section>
        </q-card>

        <div v-if="!machines.length" class="text-center text-grey-7 q-pa-md">Zatím žádné stroje</div>
        <div v-for="m in machines" :key="m[0]" class="record-card q-mb-sm">
          <div class="row items-center no-wrap">
            <div class="col">
              <div class="text-bold">{{ String(m[1]).trim() }}</div>
              <div class="text-caption text-grey-7">{{ m[2] }} Kč/hod • {{ m[3] === 'Y' ? 'aktivní' : 'vypnuto' }}</div>
            </div>
            <q-btn flat dense round icon="edit" color="primary" @click="editMachine(m)"/>
            <q-btn flat dense no-caps :label="m[3] === 'Y' ? 'Vypnout' : 'Zapnout'" :color="m[3] === 'Y' ? 'red' : 'green'"
              @click="saveMachine(m[0], m[2], m[3] === 'Y' ? 'N' : 'Y')"/>
          </div>
        </div>
      </div>
    </div>
  `
});
