// home.js
// v2026-02-25b - Oprava: česká lokalizace datumů (csLocale objekt), oprava UNDEFINED ceny oběda
// v2026-02-27 - přidána funkce checkCloudShift
// v2026-03-04 - OPRAVA: výběr času odchodu v Rozpracovaných nahrazen Quasar time pickerem
// v2026-03-04c - NOVÉ: vyhledávání v selectech Zakázka, Práce, Místo práce
// v2026-08-07 - OPRAVA: odstraněny zbytky kódu po merge konfliktu (způsobovaly prázdnou stránku)
// v2026-08-30 - OPRAVA: loadShiftState() vrácena kontrola zpět na "jen dnešek"
//             (dříve 7 dní). Důvod: 7denní okno způsobovalo, že se na Domů obnovil
//             VČEREJŠÍ (nebo starší) čas příchodu → tlačítko PŘÍCHOD bylo zablokované
//             → pracovník omylem dal ODCHOD dnes na starý příchod = téměř 24hodinová
//             směna (reálně se to stalo u Fida a Jiříka 24.-25.8.).
// v2026-08-30b - PŘESUN: záložka "Rozpracované" (nedokoncene, doplnForm a související
//              metody/šablona) přesunuta do samostatné komponenty nedokoncene.js,
//              zobrazované v Nástrojích. V home.js zůstávají jen Směna/Oběd/Záloha/
//              Objednat. Žádná jiná logika se neměnila, jen se tenhle kus vyjmul.

window.app.component('home-component', {
  props: ['currentUser', 'isAdmin', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload', 'clear-shift'],
  
  data() {
    return {
      currentTab: 'shift',
      shiftForm: {
        contractId: null,
        jobId: null,
        placeId: null,
        timeStart: null,
        timeEnd: null,
        note: ''
      },
      advanceForm: {
        amount: null,
        reason: ''
      },
      advanceSaving: false,
      contractKm: 0,
      kmManual: false,
      kmManualValue: null,
      kmRoundTrip: true,
      todayTripExists: false,
      todayTripInfo: null,
      cloudRowIndex: null,
      cloudSaving: false,
      lunchDate: '',
      lunchPrice: null,
      lunchPrices: null,
      lunchPricesLoading: false,
      contractOptionsFiltered: [],
      jobOptionsFiltered: [],
      placeOptionsFiltered: [],
      objednavkaJidlo: null,
      objednavkaPrices: null,
      objednavkaPricesLoading: false,
      objednavkaSaving: false,
      objednavkaUlozena: false,
      objednavkaUlozenaJidlo: null,
      objednavkyOstatnich: [],
      objednavkyOstatniLoading: false
    }
  },
  
  computed: {
    cloudShiftEnabled() {
      const saved = localStorage.getItem('cloudShift');
      if (saved !== null) return saved === 'true';
      return typeof DEFAULT_CLOUD_SHIFT !== 'undefined' ? DEFAULT_CLOUD_SHIFT : false;
    },
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    placeOptions() {
      return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [];
    },
    formattedStartTime() {
      return this.shiftForm.timeStart ? formatShortDateTime(this.shiftForm.timeStart) : '';
    },
    formattedEndTime() {
      return this.shiftForm.timeEnd ? formatShortDateTime(this.shiftForm.timeEnd) : '';
    },
    workedHours() {
      if (this.shiftForm.timeStart && this.shiftForm.timeEnd) {
        return ((this.shiftForm.timeEnd - this.shiftForm.timeStart) / 3600000).toFixed(2);
      }
      return '0.00';
    },
    todayDate() {
      return getTodayDate();
    },
    csLocale() {
      return {
        days: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
        daysShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
        months: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
        monthsShort: ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Září', 'Říj', 'Lis', 'Pro'],
        firstDayOfWeek: 1
      };
    },
    calculatedKm() {
      if (!this.isAdmin) return 0;
      if (this.kmManual && this.kmManualValue) {
        return this.kmRoundTrip ? this.kmManualValue * 2 : this.kmManualValue;
      }
      if (this.contractKm > 0) {
        return this.kmRoundTrip ? this.contractKm * 2 : this.contractKm;
      }
      return 0;
    }
  },
  
  methods: {
    getTodayFormatted() {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}. ${mm}. ${d.getFullYear()}`;
    },

    lunchDateToTimestamp(dateStr) {
      const parts = dateStr.split('. ');
      return new Date(parts[2], parts[1] - 1, parts[0], 12, 0).getTime();
    },

    async loadLunchPrices(dateStr) {
      this.lunchPricesLoading = true;
      this.lunchPrice = null;
      try {
        const ts = this.lunchDateToTimestamp(dateStr);
        const res = await apiCall('getlunchprice', { date: ts });
        if (res.code === '000' && res.data && res.data.price1 != null && res.data.price1 !== '') {
          this.lunchPrices = res.data;
          this.lunchPrice = res.data.price1;
        } else {
          this.lunchPrices = null;
        }
      } catch (e) {
        this.lunchPrices = null;
      }
      this.lunchPricesLoading = false;
    },

    async setArrival() {
      this.shiftForm.timeStart = Date.now();
      this.saveShiftState();
      if (this.cloudShiftEnabled) {
        this.cloudSaving = true;
        try {
          const res = await apiCall('savearrival', {
            id_worker: this.currentUser.id,
            time_fr: this.shiftForm.timeStart
          });
          if (res.code === '000' && res.data && res.data.rowIndex !== undefined) {
            this.cloudRowIndex = res.data.rowIndex;
            this.saveShiftState();
            this.$emit('message', '✓ Příchod uložen do tabulky: ' + formatTime(this.shiftForm.timeStart));
          } else {
            this.$emit('message', '⚠️ Příchod lokálně (chyba cloudu): ' + (res.error || ''));
          }
        } catch (e) {
          this.$emit('message', '⚠️ Příchod lokálně (offline)');
        }
        this.cloudSaving = false;
      } else {
        this.$emit('message', 'Příchod: ' + formatTime(this.shiftForm.timeStart));
      }
    },
    
    async setDeparture() {
      if (!this.shiftForm.timeStart) {
        this.$emit('message', 'Nejdříve zaznamenejte příchod');
        return;
      }
      this.shiftForm.timeEnd = Date.now();
      this.saveShiftState();
      if (this.cloudShiftEnabled) {
        this.cloudSaving = true;
        try {
          if (this.cloudRowIndex !== null) {
            const res = await apiCall('updatedeparture', {
              row_index: this.cloudRowIndex,
              time_to: this.shiftForm.timeEnd
            });
            if (res.code === '000') {
              this.$emit('message', '✓ Odchod uložen do tabulky: ' + formatTime(this.shiftForm.timeEnd));
            } else {
              this.$emit('message', '⚠️ Odchod lokálně (chyba cloudu): ' + (res.error || ''));
            }
          } else {
            this.$emit('message', '⚠️ Odchod lokálně (chybí rowIndex)');
          }
        } catch (e) {
          this.$emit('message', '⚠️ Odchod lokálně (offline)');
        }
        this.cloudSaving = false;
      } else {
        this.$emit('message', 'Odchod: ' + formatTime(this.shiftForm.timeEnd));
      }
    },
    
    async loadContractKm() {
      if (!this.isAdmin || !this.shiftForm.contractId) {
        this.contractKm = 0;
        return;
      }
      try {
        const res = await apiCall('getcontractkm', { id_contract: this.shiftForm.contractId });
        if (res.code === '000' && res.data) {
          this.contractKm = res.data.km || 0;
          const tripCheck = await apiCall('checktodaytrip', { id_contract: this.shiftForm.contractId });
          if (tripCheck.code === '000' && tripCheck.data && tripCheck.data.exists) {
            this.todayTripExists = true;
            this.todayTripInfo = tripCheck.data;
          } else {
            this.todayTripExists = false;
            this.todayTripInfo = null;
          }
        }
      } catch (error) {
        console.error('Chyba načítání km:', error);
      }
    },
    
    async saveShift() {
      if (!this.shiftForm.contractId || !this.shiftForm.jobId || !this.shiftForm.timeStart || !this.shiftForm.timeEnd) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      if (!this.shiftForm.note || this.shiftForm.note.trim() === '') {
        this.$emit('message', 'Poznámka je povinná');
        return;
      }
      if (!this.shiftForm.placeId) {
        this.$emit('message', 'Vyberte místo práce');
        return;
      }
      try {
        const payload = {
          id_contract: this.shiftForm.contractId,
          id_worker: this.currentUser.id,
          id_job: this.shiftForm.jobId,
          id_place: this.shiftForm.placeId,
          time_fr: this.shiftForm.timeStart,
          time_to: this.shiftForm.timeEnd,
          note: this.shiftForm.note
        };
        if (this.isAdmin && this.calculatedKm > 0) {
          payload.km_jednosmer = this.kmManual ? (this.kmManualValue || 0) : this.contractKm;
          payload.km_celkem = this.calculatedKm;
          payload.km_rucne = this.kmManual ? 'Y' : 'N';
        }
        let res;
        if (this.cloudShiftEnabled && this.cloudRowIndex !== null) {
          payload.row_index = this.cloudRowIndex;
          res = await apiCall('completerecord', payload);
        } else {
          res = await apiCall('saverecord', payload);
        }
        if (res.code === '000') {
          const kmText = this.calculatedKm > 0 ? ` (${this.calculatedKm} km)` : '';
          this.$emit('message', `✓ Směna uložena${kmText}`);
          this.clearShiftState();
          this.$emit('reload');
        } else if (res.code === '101') {
          this.$emit('message', '⚠️ Tato směna je již uložena. Pokud je problém, jděte do Nastavení → Smazat směnu.');
        } else {
          this.$emit('message', '❌ Chyba při ukládání: ' + (res.error || 'Neznámá chyba'));
        }
      } catch (error) {
        console.error('Save shift error:', error);
        this.$emit('message', '❌ Chyba připojení. Zkuste znovu nebo jděte do Nastavení → Smazat směnu.');
      }
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
    },

    saveShiftState() {
      const state = {
        timeStart: this.shiftForm.timeStart,
        timeEnd: this.shiftForm.timeEnd,
        contractId: this.shiftForm.contractId,
        jobId: this.shiftForm.jobId,
        placeId: this.shiftForm.placeId,
        note: this.shiftForm.note,
        cloudRowIndex: this.cloudRowIndex,
        date: getTodayDate()
      };
      localStorage.setItem('shiftState_' + this.currentUser.id, JSON.stringify(state));
    },
    
    loadShiftState() {
      const saved = localStorage.getItem('shiftState_' + this.currentUser.id);
      if (saved) {
        const state = JSON.parse(saved);
        // v2026-08-30 OPRAVA: vráceno zpět na "jen dnešek" (dřív bylo 7 dní).
        // Duvod je popsaný v hlavičce souboru nahoře.
        if (state.date === getTodayDate()) {
          this.shiftForm.timeStart = state.timeStart;
          this.shiftForm.timeEnd = state.timeEnd;
          this.shiftForm.contractId = state.contractId;
          this.shiftForm.jobId = state.jobId;
          this.shiftForm.placeId = state.placeId;
          this.shiftForm.note = state.note;
          this.cloudRowIndex = state.cloudRowIndex || null;
          return true;
        } else {
          this.clearShiftState();
        }
      }
      return false;
    },

    async checkCloudShift() {
      try {
        const res = await apiCall('getdayrecords', { date: getTodayDate() });
        if (res.code !== '000' || !res.data) return;
        const rozpracovany = res.data.find(r =>
          String(r[1]) === String(this.currentUser.id) && r[15] === 'rozpracováno'
        );
        if (rozpracovany) {
          this.shiftForm.timeStart = Number(rozpracovany[4]);
          this.cloudRowIndex = rozpracovany[16];
          this.saveShiftState();
          this.$emit('message', '☁ Načtena rozpracovaná šichta: ' + formatTime(this.shiftForm.timeStart));
        }
      } catch (e) {}
    },
    
    clearShiftState() {
      localStorage.removeItem('shiftState_' + this.currentUser.id);
      this.shiftForm = {
        contractId: null,
        jobId: null,
        placeId: null,
        timeStart: null,
        timeEnd: null,
        note: ''
      };
      this.contractKm = 0;
      this.kmManual = false;
      this.kmManualValue = null;
      this.kmRoundTrip = true;
      this.todayTripExists = false;
      this.todayTripInfo = null;
      this.cloudRowIndex = null;
    },
    
    async loadObjednavkuPrices() {
      this.objednavkaPricesLoading = true;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(11, 0, 0, 0);
      try {
        const res = await apiCall('getlunchprice', { date: tomorrow.getTime() });
        if (res.code === '000' && res.data && res.data.price1 != null) {
          this.objednavkaPrices = res.data;
        } else {
          this.objednavkaPrices = null;
        }
      } catch(e) { this.objednavkaPrices = null; }
      this.objednavkaPricesLoading = false;
    },

    async loadObjednavkyOstatnich() {
      this.objednavkyOstatniLoading = true;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(11, 0, 0, 0);
      try {
        const res = await apiCall('getobjednavky', { datum: tomorrow.getTime() });
        if (res.code === '000') {
          this.objednavkyOstatnich = (res.data || []).sort((a, b) => Number(a[4]) - Number(b[4]));
        }
      } catch(e) {}
      this.objednavkyOstatniLoading = false;
    },

    async saveObjednavka() {
      if (!this.objednavkaJidlo) {
        this.$emit('message', 'Vyberte jídlo');
        return;
      }
      this.objednavkaSaving = true;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(11, 0, 0, 0);
      let cena = 0;
      if (this.objednavkaPrices) {
        cena = (this.objednavkaJidlo <= 3 || !this.objednavkaPrices.price2)
          ? this.objednavkaPrices.price1
          : this.objednavkaPrices.price2;
      }
      try {
        const res = await apiCall('saveobjednavka', {
          id_worker: this.currentUser.id,
          name_worker: this.currentUser.name,
          jidlo: this.objednavkaJidlo,
          cena: cena,
          datum: tomorrow.getTime()
        });
        if (res.code === '000') {
          this.objednavkaUlozena = true;
          this.objednavkaUlozenaJidlo = this.objednavkaJidlo;
          await this.loadObjednavkyOstatnich();
          this.$emit('message', '✓ Objednávka uložena — jídlo č. ' + this.objednavkaJidlo);
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch(e) {
        this.$emit('message', 'Chyba při ukládání');
      }
      this.objednavkaSaving = false;
    },

    async saveLunch() {
      if (!this.lunchPrice) {
        this.$emit('message', 'Vyberte cenu oběda');
        return;
      }
      try {
        const timestamp = this.lunchDateToTimestamp(this.lunchDate);
        const res = await apiCall('savelunch', {
          id_worker: this.currentUser.id,
          name_worker: this.currentUser.name,
          time: timestamp,
          payment: this.lunchPrice
        });
        if (res.code === '000') {
          this.$emit('message', `✓ Oběd uložen (${this.lunchPrice} Kč)`);
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání oběda');
      }
    },
    
    async saveAdvance() {
      if (!this.advanceForm.amount || !this.advanceForm.reason) {
        this.$emit('message', 'Vyplňte částku a důvod');
        return;
      }
      if (this.advanceSaving) return;
      this.advanceSaving = true;
      try {
        const res = await apiCall('saveadvance', {
          id_worker: this.currentUser.id,
          name_worker: this.currentUser.name,
          time: Date.now(),
          payment: this.advanceForm.amount,
          payment_reason: this.advanceForm.reason
        });
        if (res.code === '000') {
          this.$emit('message', '✓ Záloha uložena');
          this.advanceForm.amount = null;
          this.advanceForm.reason = '';
          this.$emit('reload');
        } else if (res.code === '101') {
          this.$emit('message', '⚠️ Tato záloha již byla dnes uložena (duplikát)');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání zálohy');
      }
      this.advanceSaving = false;
    }
  },
  
  watch: {
    'shiftForm.contractId': function() {
      this.saveShiftState();
      if (this.isAdmin) this.loadContractKm();
    },
    'shiftForm.jobId': function() { this.saveShiftState(); },
    'shiftForm.placeId': function() { this.saveShiftState(); },
    'shiftForm.note': function() { this.saveShiftState(); },
    lunchDate(newDate) {
      if (newDate) this.loadLunchPrices(newDate);
    },
    currentTab(val) {
      if (val === 'objednat') {
        this.loadObjednavkuPrices();
        this.loadObjednavkyOstatnich();
      }
    }
  },
  
  async mounted() {
    const nactenoZLocalStorage = this.loadShiftState();
    if (!nactenoZLocalStorage || !this.shiftForm.timeStart) {
      await this.checkCloudShift();
    }
    this.lunchDate = this.getTodayFormatted();
    this.loadLunchPrices(this.lunchDate);
  },
  
  template: `
    <div>
      <q-tabs v-model="currentTab" dense align="justify" class="text-primary">
        <q-tab name="shift" label="Směna"/>
        <q-tab name="lunch" label="Oběd"/>
        <q-tab name="advance" label="Záloha"/>
        <q-tab name="objednat" label="Objednat"/>
      </q-tabs>
      
      <!-- SMĚNA -->
      <div v-if="currentTab==='shift'" class="q-pt-md">
        <div v-if="cloudShiftEnabled" class="q-mb-sm q-pa-xs text-caption text-blue-7" style="background:#e3f2fd;border-radius:4px">
          ☁ Cloud režim – příchod/odchod se ukládá přímo do tabulky
        </div>

        <q-btn @click="setArrival" color="green" icon="login" label="PŘÍCHOD"
          class="full-width q-mb-md" :disabled="!!shiftForm.timeStart || cloudSaving" :loading="cloudSaving && !shiftForm.timeStart"/>
        
        <div v-if="shiftForm.timeStart" class="q-mb-md q-pa-sm" style="background:#e8f5e9;border-radius:4px">
          <div class="text-bold text-green-8">✓ Příchod zaznamenán</div>
          <div>{{formattedStartTime}}</div>
          <div v-if="cloudShiftEnabled && cloudRowIndex !== null" class="text-caption text-blue-7">☁ Uloženo v tabulce (řádek {{cloudRowIndex}})</div>
          <div v-if="cloudShiftEnabled && cloudRowIndex === null" class="text-caption text-orange-7">⚠ Uloženo jen lokálně</div>
        </div>
        
        <q-btn @click="setDeparture" color="orange" icon="logout" label="ODCHOD"
          class="full-width q-mb-md" :disabled="!shiftForm.timeStart || !!shiftForm.timeEnd || cloudSaving" :loading="cloudSaving && !!shiftForm.timeStart && !shiftForm.timeEnd"/>
        
        <div v-if="shiftForm.timeEnd" class="q-mb-md q-pa-sm" style="background:#fff3e0;border-radius:4px">
          <div class="text-bold text-orange-8">✓ Odchod zaznamenán</div>
          <div>{{formattedEndTime}}</div>
          <div class="text-primary text-bold q-mt-sm">Odpracováno: {{workedHours}} hod</div>
        </div>
        
        <q-select v-model="shiftForm.contractId" :options="contractOptionsFiltered"
          label="Zakázka *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterContracts" @focus="filterContracts('', v => contractOptionsFiltered = contractOptions)"/>
        
        <q-select v-model="shiftForm.jobId" :options="jobOptionsFiltered"
          label="Práce *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterJobs" @focus="filterJobs('', v => jobOptionsFiltered = jobOptions)"/>
        
        <q-select v-model="shiftForm.placeId" :options="placeOptionsFiltered"
          label="Místo práce *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterPlaces" @focus="filterPlaces('', v => placeOptionsFiltered = placeOptions)"/>
        
        <q-input v-model="shiftForm.note" label="Poznámka *"
          outlined class="q-mb-md" type="textarea" rows="3"/>
        
        <div v-if="isAdmin && contractKm > 0" class="q-mb-md">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2">🚗 Kilometry</div>
              <q-banner v-if="todayTripExists" class="bg-orange-2 q-mt-sm" dense rounded>
                ⚠️ Dnes už tam jel: {{ todayTripInfo.worker }} ({{ todayTripInfo.km }} km)
              </q-banner>
              <div class="q-mt-sm">
                <div class="text-caption text-grey-7">Zakázka má: {{ contractKm }} km jedna cesta</div>
                <q-checkbox v-model="kmRoundTrip" label="Tam a zpět (×2)" class="q-mt-sm"/>
                <div class="text-bold text-primary q-mt-xs">Celkem: {{ calculatedKm }} km</div>
                <q-checkbox v-model="kmManual" label="Zadat km ručně" class="q-mt-sm"/>
                <q-input v-if="kmManual" v-model.number="kmManualValue"
                  label="Počet km" type="number" outlined dense class="q-mt-sm"/>
              </div>
            </q-card-section>
          </q-card>
        </div>
        
        <q-btn @click="saveShift" label="Uložit směnu" color="primary"
          :loading="loading" class="full-width" size="lg"/>
      </div>
      
      <!-- OBĚD -->
      <div v-if="currentTab==='lunch'" class="q-pt-md">
        <q-input v-model="lunchDate" label="Datum oběda" outlined dense readonly class="q-mb-md">
          <template v-slot:prepend><q-icon name="restaurant" color="orange"/></template>
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer" color="primary">
              <q-popup-proxy cover ref="lunchDateProxy">
                <q-date v-model="lunchDate" mask="DD. MM. YYYY" :locale="csLocale"
                  @update:model-value="$refs.lunchDateProxy.hide()"/>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <div v-if="lunchPricesLoading" class="text-center q-pa-md text-grey-6">
          <q-spinner size="2em" color="orange"/>
          <div class="q-mt-sm">Načítám ceny...</div>
        </div>
        <div v-else-if="!lunchPrices" class="q-mb-md q-pa-sm text-orange-8" style="background:#fff3e0;border-radius:4px">
          ⚠ Pro vybrané datum nebyla nalezena cena oběda
        </div>
        <div v-else class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm text-grey-7">Vyberte cenu oběda:</div>
          <div class="row q-gutter-sm">
            <q-btn :outline="lunchPrice !== lunchPrices.price1" :unelevated="lunchPrice === lunchPrices.price1"
              color="orange" :label="lunchPrices.price1 + ' Kč'" icon="restaurant" class="col" size="lg"
              @click="lunchPrice = lunchPrices.price1"/>
            <q-btn v-if="lunchPrices.price2"
              :outline="lunchPrice !== lunchPrices.price2" :unelevated="lunchPrice === lunchPrices.price2"
              color="deep-orange" :label="lunchPrices.price2 + ' Kč'" icon="restaurant_menu" class="col" size="lg"
              @click="lunchPrice = lunchPrices.price2"/>
          </div>
        </div>
        <div v-if="lunchPrice" class="q-mb-md q-pa-sm text-center" style="background:#e8f5e9;border-radius:4px">
          <div class="text-h6 text-green-8">✓ Vybráno: <strong>{{ lunchPrice }} Kč</strong></div>
          <div class="text-caption text-grey-7">{{ lunchDate }}</div>
        </div>
        <q-btn @click="saveLunch" label="Uložit oběd" color="orange"
          :loading="loading" class="full-width" size="lg" icon="restaurant"
          :disabled="!lunchPrice || !lunchPrices"/>
      </div>
      
      <!-- ZÁLOHA -->
      <div v-if="currentTab==='advance'" class="q-pt-md">
        <q-input v-model.number="advanceForm.amount" label="Částka (Kč) *"
          type="number" outlined class="q-mb-md"/>
        <q-input v-model="advanceForm.reason" label="Důvod *"
          outlined class="q-mb-md" type="textarea" rows="2"/>
        <q-btn @click="saveAdvance" label="Uložit zálohu" color="primary"
          :loading="advanceSaving" class="full-width" size="lg"/>
      </div>

      <!-- OBJEDNAT OBĚD -->
      <div v-if="currentTab==='objednat'" class="q-pt-md">
        <div class="text-subtitle1 text-bold q-mb-xs">🍽 Objednávka oběda na zítřek</div>

        <div v-if="objednavkaUlozena" class="q-mb-md q-pa-md text-center"
          style="background:#e8f5e9; border-radius:8px; border:2px solid #4caf50">
          <div class="text-h5 text-green-8">✓ Objednáno</div>
          <div class="text-h6 text-green-7">Jídlo č. {{ objednavkaUlozenaJidlo }}</div>
          <q-btn flat dense label="Změnit" size="sm" color="grey" class="q-mt-sm"
            @click="objednavkaUlozena = false; objednavkaJidlo = objednavkaUlozenaJidlo"/>
        </div>

        <div v-if="objednavkaPricesLoading" class="text-center q-pa-md text-grey-6">
          <q-spinner size="2em" color="orange"/>
        </div>
        <div v-else-if="!objednavkaPrices && !objednavkaUlozena" class="q-mb-md q-pa-sm text-orange-8" style="background:#fff3e0;border-radius:4px">
          ⚠ Pro zítřejší datum nebyla nalezena cena oběda
        </div>

        <div v-if="!objednavkaUlozena && objednavkaPrices">
          <div class="row q-gutter-md q-mb-md">
            <q-btn v-for="n in 4" :key="n"
              :unelevated="objednavkaJidlo === n" :outline="objednavkaJidlo !== n"
              :color="n <= 3 ? 'orange' : 'deep-orange'"
              class="col" style="height:72px" @click="objednavkaJidlo = n">
              <div class="text-center">
                <div style="font-size:1.6rem; font-weight:800; line-height:1">{{ n }}</div>
                <div style="font-size:0.65rem; opacity:0.85">
                  {{ n <= 3 || !objednavkaPrices.price2 ? objednavkaPrices.price1 : objednavkaPrices.price2 }} Kč
                </div>
              </div>
            </q-btn>
          </div>
          <div v-if="objednavkaJidlo" class="q-mb-md q-pa-sm text-center" style="background:#fff3e0; border-radius:4px">
            <div class="text-subtitle1">Jídlo č. <strong>{{ objednavkaJidlo }}</strong>
              — <strong>{{ objednavkaJidlo <= 3 || !objednavkaPrices.price2 ? objednavkaPrices.price1 : objednavkaPrices.price2 }} Kč</strong>
            </div>
          </div>
          <q-btn @click="saveObjednavka" label="Potvrdit objednávku" color="orange"
            :loading="objednavkaSaving" :disabled="!objednavkaJidlo"
            class="full-width" size="lg" icon="check"/>
        </div>

        <div class="q-mt-md">
          <div class="text-subtitle2 text-bold q-mb-xs">Objednávky na zítřek</div>
          <div v-if="objednavkyOstatniLoading" class="text-center text-grey-6"><q-spinner size="1.2em"/></div>
          <div v-else-if="objednavkyOstatnich.length === 0" class="text-caption text-grey-6">Zatím nikdo neobjednal</div>
          <div v-else>
            <div v-for="(r, i) in objednavkyOstatnich" :key="i"
              class="row items-center no-wrap q-mb-xs"
              style="border-bottom:1px solid #f5f5f5; padding:3px 0">
              <q-badge :color="Number(r[4]) <= 3 ? 'orange' : 'deep-orange'"
                style="font-size:0.8rem; min-width:22px; text-align:center">{{ r[4] }}</q-badge>
              <span class="q-ml-sm" style="font-size:0.85rem">{{ r[1] }}</span>
              <span class="col"/>
              <span class="text-grey-6" style="font-size:0.78rem">{{ r[5] }} Kč</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
});
