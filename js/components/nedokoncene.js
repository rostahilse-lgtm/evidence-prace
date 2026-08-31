// nedokoncene.js
// v2026-08-30 - NOVÝ SOUBOR: Rozpracované vyňato z home.js do samostatné komponenty
// v2026-08-31 - OPRAVA: rowIndex byl na špatném indexu (r[16] = sloupec stav/log,
//             ne číslo řádku). getWorkerRecords v kod.gs dělá slice(0,17) [indexy 0-16]
//             a teprve POTOM r.push(i) přidá skutečné číslo řádku jako index 17.
//             Proto se posílal NaN na server -> "Počáteční řádek rozsahu je příliš malý"
//             OPRAVENO: rowIndex: r[16] -> rowIndex: r[17]

window.app.component('nedokoncene-component', {
  props: ['currentUser', 'contracts', 'jobs', 'places'],
  emits: ['message', 'reload'],

  data() {
    return {
      nedokoncene: [],
      nedokonceneLoading: false,
      doplnForm: null,
      doplnSaving: false,
      contractOptionsFiltered: [],
      jobOptionsFiltered: [],
      placeOptionsFiltered: []
    }
  },

  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    placeOptions() {
      return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [];
    }
  },

  methods: {
    async loadNedokoncene() {
      this.nedokonceneLoading = true;
      try {
        const res = await apiCall('getrecords', { id_worker: this.currentUser.id, source: 'new' });
        if (res.code === '000' && res.data) {
          this.nedokoncene = res.data.filter(r => String(r[15] || '').trim() === 'rozpracováno');
        }
      } catch(e) {}
      this.nedokonceneLoading = false;
    },

    zacitDoplnovat(r) {
      this.doplnForm = {
        rowIndex: r[17],
        timeStart: Number(r[4]),
        timeEnd: null,
        timeEndStr: '',
        contractId: null,
        jobId: null,
        placeId: null,
        note: ''
      };
    },

    zrusitDoplneni() {
      this.doplnForm = null;
    },

    async ulozitDoplneni() {
      if (!this.doplnForm.contractId || !this.doplnForm.jobId || !this.doplnForm.placeId) {
        this.$emit('message', 'Vyplňte zakázku, práci a místo práce');
        return;
      }
      if (!this.doplnForm.note || this.doplnForm.note.trim() === '') {
        this.$emit('message', 'Poznámka je povinná');
        return;
      }
      if (!this.doplnForm.timeEnd) {
        this.$emit('message', 'Zadejte čas odchodu');
        return;
      }
      this.doplnSaving = true;
      try {
        const payload = {
          row_index: this.doplnForm.rowIndex,
          id_contract: this.doplnForm.contractId,
          id_worker: this.currentUser.id,
          id_job: this.doplnForm.jobId,
          id_place: this.doplnForm.placeId,
          time_fr: this.doplnForm.timeStart,
          time_to: this.doplnForm.timeEnd,
          note: this.doplnForm.note,
          opraveno: 'Y'
        };
        const res = await apiCall('completerecord', payload);
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam doplněn a uložen');
          this.doplnForm = null;
          await this.loadNedokoncene();
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || ''));
        }
      } catch(e) {
        this.$emit('message', 'Chyba při ukládání');
      }
      this.doplnSaving = false;
    },

    filterContracts(val, update) {
      update(() => {
        if (val === '') {
          this.contractOptionsFiltered = this.contractOptions;
        } else {
          const needle = val.toLowerCase();
          this.contractOptionsFiltered = this.contractOptions.filter(o => o.label.toLowerCase().includes(needle));
        }
      });
    },

    filterJobs(val, update) {
      update(() => {
        if (val === '') {
          this.jobOptionsFiltered = this.jobOptions;
        } else {
          const needle = val.toLowerCase();
          this.jobOptionsFiltered = this.jobOptions.filter(o => o.label.toLowerCase().includes(needle));
        }
      });
    },

    filterPlaces(val, update) {
      update(() => {
        if (val === '') {
          this.placeOptionsFiltered = this.placeOptions;
        } else {
          const needle = val.toLowerCase();
          this.placeOptionsFiltered = this.placeOptions.filter(o => o.label.toLowerCase().includes(needle));
        }
      });
    }
  },

  mounted() {
    this.loadNedokoncene();
  },

  template: `
    <div class="q-pt-sm">
      <div class="q-mb-sm q-pa-xs text-caption text-orange-8" style="background:#fff3e0;border-radius:4px">
        ⚠ Záznamy kde chybí zakázka, práce nebo odchod. Doplňte je kdykoli.
      </div>
      <div v-if="nedokonceneLoading" class="text-center q-pa-md"><q-spinner color="orange" size="2em"/></div>
      <div v-else-if="nedokoncene.length === 0" class="text-center text-grey-7 q-mt-lg">✓ Žádné rozpracované záznamy</div>
      <div v-else-if="!doplnForm">
        <div v-for="(r, idx) in nedokoncene" :key="idx" class="record-card q-mb-sm">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold text-orange-8">Příchod: {{ new Date(Number(r[4])).toLocaleString("cs-CZ", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) }}</div>
              <div class="text-caption text-grey-7">{{ r[0] || "Zakázka nevyplněna" }} • {{ r[3] || "Práce nevyplněna" }}</div>
            </div>
            <q-btn color="orange" icon="edit" label="Doplnit" size="sm" unelevated @click="zacitDoplnovat(r)"/>
          </div>
        </div>
      </div>
      <div v-else>
        <div class="q-mb-md q-pa-sm text-center" style="background:#fff3e0;border-radius:4px">
          <div class="text-bold text-orange-8">Příchod: {{ new Date(doplnForm.timeStart).toLocaleString("cs-CZ", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) }}</div>
          <div class="text-caption text-grey-6">Čas příchodu nelze měnit</div>
        </div>
        <div class="q-mb-md">
          <q-input v-model="doplnForm.timeEndStr" label="Čas odchodu *" outlined dense readonly
            hint="Datum příchodu se použije automaticky">
            <template v-slot:prepend><q-icon name="logout" color="orange"/></template>
            <template v-slot:append>
              <q-icon name="schedule" class="cursor-pointer" color="primary">
                <q-popup-proxy cover ref="doplnTimeProxy">
                  <q-time v-model="doplnForm.timeEndStr" mask="HH:mm" format24h
                    @update:model-value="val => {
                      if (val && val.length === 5) {
                        $refs.doplnTimeProxy.hide();
                        const d = new Date(doplnForm.timeStart);
                        const [h, m] = val.split(':');
                        d.setHours(parseInt(h), parseInt(m), 0);
                        doplnForm.timeEnd = d.getTime();
                      }
                    }"
                  />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
        <q-select v-model="doplnForm.contractId" :options="contractOptionsFiltered"
          label="Zakázka *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterContracts" @focus="filterContracts('', v => contractOptionsFiltered = contractOptions)"/>
        <q-select v-model="doplnForm.jobId" :options="jobOptionsFiltered"
          label="Práce *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterJobs" @focus="filterJobs('', v => jobOptionsFiltered = jobOptions)"/>
        <q-select v-model="doplnForm.placeId" :options="placeOptionsFiltered"
          label="Místo práce *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterPlaces" @focus="filterPlaces('', v => placeOptionsFiltered = placeOptions)"/>
        <q-input v-model="doplnForm.note" label="Poznámka *" outlined class="q-mb-md" type="textarea" rows="3"/>
        <div class="row q-gutter-sm">
          <q-btn @click="ulozitDoplneni" label="Uložit záznam" color="primary" :loading="doplnSaving" class="col" size="lg" unelevated/>
          <q-btn @click="zrusitDoplneni" label="Zpět" color="grey" outline size="lg"/>
        </div>
      </div>
    </div>
  `
});
