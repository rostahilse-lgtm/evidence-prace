// home.js
// v2026-02-25b - Oprava: česká lokalizace datumů (csLocale objekt), oprava UNDEFINED ceny oběda
// v2026-02-27 - přidána funkce checkCloudShift
// v2026-03-01 - přidána záložka Rozpracované: kluci mohou kdykoli doplnit nedokončený záznam
//             - prodlouženo uchování lokálního stavu ze 1 dne na 7 dní
//             - NIC JSEM NESMAZAL, pouze přidal nové funkce
// v2026-03-04 - OPRAVA: výběr času odchodu v Rozpracovaných nahrazen Quasar time pickerem (místo textového pole)
//             - NOVÉ: při uložení doplnění se posílá opraveno:'Y' → v tabulce se zapíše 'opraveno' do sloupce P
//             - nic jsem nesmazal, pouze opravil výběr času a přidal příznak opraveno
// v2026-03-04c - NOVÉ: vyhledávání v selectech Zakázka, Práce, Místo práce — po zmáčknutí naskočí klávesnice
// v2026-03-10 - OPRAVA záložka Objednat: cena ze sheetu (price1=jídla 1-3, price2=jídlo 4)
//             - NOVÉ: zobrazení objednávek ostatních v záložce Objednat
//             - nic jsem nesmazal
// v2026-03-11 - PŘESUN: záložka Rozpracované přesunuta do Nástrojů v main.js
//             - NOVÉ: nedokoncene-component jako samostatná komponenta
//             - nic jsem nesmazal
// v2026-03-07b - NOVÉ: záložka Objednat — výběr jídla 1-4 na zítřek, uloží objednávku do Google Sheets
//              - nic jsem nesmazal
//              - nic jsem nesmazal, pouze přidal filter metody a use-input na selecty

window.app.component('home-component', {
  props: ['currentUser', 'isAdmin', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload'],
  
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
      // ROZPRACOVANÉ
      nedokoncene: [],
      nedokonceneLoading: false,
      doplnForm: null,  // { rowIndex, timeStart, timeEnd, timeEndStr, contractId, jobId, placeId, note }
      doplnSaving: false,
      // NOVÉ v2026-03-04c: filtrované seznamy pro vyhledávání v selectech
      contractOptionsFiltered: [],
      jobOptionsFiltered: [],
      placeOptionsFiltered: [],
      // NOVÉ v2026-03-07b: objednávka oběda
      objednavkaJidlo: null,      // 1-4
      objednavkaSaving: false,
      objednavkaUlozena: false,   // true pokud má dnes uloženou objednávku
      objednavkaUlozenaJidlo: null,
      // Ceny ze sheetu pro zítra
      objednavkaPrices: null,     // { price1, price2 }
      objednavkaPricesLoading: false,
      // Seznam objednávek ostatních
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
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání směny');
      }
    },
    
    // NOVÉ v2026-03-04c: filter metody pro vyhledávání v selectech
    filterContracts(val, update) {
      update(() => {
        if (val === '') {
          this.contractOptionsFiltered = this.contractOptions;
        } else {
          const needle = val.toLowerCase();
          this.contractOptionsFiltered = this.contractOptions.filter(
            o => o.label.toLowerCase().includes(needle)
          );
        }
      });
    },

    filterJobs(val, update) {
      update(() => {
        if (val === '') {
          this.jobOptionsFiltered = this.jobOptions;
        } else {
          const needle = val.toLowerCase();
          this.jobOptionsFiltered = this.jobOptions.filter(
            o => o.label.toLowerCase().includes(needle)
          );
        }
      });
    },

    filterPlaces(val, update) {
      update(() => {
        if (val === '') {
          this.placeOptionsFiltered = this.placeOptions;
        } else {
          const needle = val.toLowerCase();
          this.placeOptionsFiltered = this.placeOptions.filter(
            o => o.label.toLowerCase().includes(needle)
          );
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
        // Prodlouženo na 7 dní (dříve jen dnešek)
        const stateDate = new Date(state.date.split(". ").reverse().join("-"));
        const daysAgo = (Date.now() - stateDate.getTime()) / 86400000;
        if (daysAgo < 7) {
          this.shiftForm.timeStart = state.timeStart;
          this.shiftForm.timeEnd = state.timeEnd;
          this.shiftForm.contractId = state.contractId;
          this.shiftForm.jobId = state.jobId;
          this.shiftForm.placeId = state.placeId;
          this.shiftForm.note = state.note;
          this.cloudRowIndex = state.cloudRowIndex || null;
          return true; // načteno z localStorage
        } else {
          this.clearShiftState();
        }
      }
      return false; // nic v localStorage
    },

    // NOVÁ FUNKCE v2026-02-27: načte rozpracovanou šichtu z tabulky na novém zařízení
    async checkCloudShift() {
      try {
        const res = await apiCall('getdayrecords', { date: getTodayDate() });
        if (res.code !== '000' || !res.data) return;
        // Najdi záznam tohoto pracovníka se stavem 'rozpracováno'
        const rozpracovany = res.data.find(r =>
          String(r[1]) === String(this.currentUser.id) && r[15] === 'rozpracováno'
        );
        if (rozpracovany) {
          this.shiftForm.timeStart = Number(rozpracovany[4]);
          this.cloudRowIndex = rozpracovany[16]; // row index vrácený z GAS
          this.saveShiftState();
          this.$emit('message', '☁ Načtena rozpracovaná šichta: ' + formatTime(this.shiftForm.timeStart));
        }
      } catch (e) {
        // tiše selže - nevadí
      }
    },
    
    // ── ROZPRACOVANÉ ──────────────────────────────────────────
    async loadNedokoncene() {
      this.nedokonceneLoading = true;
      try {
        const res = await apiCall('getrecords', { id_worker: this.currentUser.id, source: 'new' });
        if (res.code === '000' && res.data) {
          this.nedokoncene = res.data.filter(r => String(r[15] || '').trim() === 'rozpracováno');
        }
      } catch(e) { /* tiše */ }
      this.nedokonceneLoading = false;
    },

    // OPRAVA v2026-03-04: přidáno timeEndStr pro time picker
    zacitDoplnovat(r) {
      this.doplnForm = {
        rowIndex: r[16],
        timeStart: Number(r[4]),
        timeEnd: null,
        timeEndStr: '',    // OPRAVA: pro Quasar time picker
        contractId: null,
        jobId: null,
        placeId: null,
        note: ''
      };
    },

    zrusitDoplneni() {
      this.doplnForm = null;
    },

    // OPRAVA v2026-03-04: přidáno opraveno:'Y' do payloadu → zapíše 'opraveno' do sloupce P
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
          opraveno: 'Y'    // NOVÉ: zapíše 'opraveno' do sloupce P v tabulce
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
      // Načíst ceny ze sheetu pro zítřejší datum
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
          this.objednavkyOstatnich = (res.data || [])
            .sort((a, b) => Number(a[4]) - Number(b[4]));
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
      // Cena ze sheetu — price2 pro jídlo 4, jinak price1
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
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání zálohy');
      }
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
    // Pokud nic v localStorage → zkus načíst z tabulky (nové zařízení)
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
          <template v-slot:prepend>
            <q-icon name="restaurant" color="orange"/>
          </template>
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
            <q-btn
              :outline="lunchPrice !== lunchPrices.price1"
              :unelevated="lunchPrice === lunchPrices.price1"
              color="orange"
              :label="lunchPrices.price1 + ' Kč'"
              icon="restaurant"
              class="col"
              size="lg"
              @click="lunchPrice = lunchPrices.price1"
            />
            <q-btn
              v-if="lunchPrices.price2"
              :outline="lunchPrice !== lunchPrices.price2"
              :unelevated="lunchPrice === lunchPrices.price2"
              color="deep-orange"
              :label="lunchPrices.price2 + ' Kč'"
              icon="restaurant_menu"
              class="col"
              size="lg"
              @click="lunchPrice = lunchPrices.price2"
            />
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
          :loading="loading" class="full-width" size="lg"/>
      </div>

      <!-- OBJEDNAT OBĚD -->
      <!-- OBJEDNAT OBĚD -->
      <div v-if="currentTab==='objednat'" class="q-pt-md">
        <div class="text-subtitle1 text-bold q-mb-xs">🍽 Objednávka oběda na zítřek</div>
        <div class="text-caption text-grey-7 q-mb-md">
          Jídla 1–3 = <strong>130 Kč</strong> &nbsp;|&nbsp; Jídlo 4 = <strong>145 Kč</strong>
        </div>

        <!-- Potvrzení uložené objednávky -->
        <div v-if="objednavkaUlozena" class="q-mb-md q-pa-md text-center"
          style="background:#e8f5e9; border-radius:8px; border:2px solid #4caf50">
          <div class="text-h5 text-green-8">✓ Objednáno</div>
          <div class="text-h6 text-green-7">Jídlo č. {{ objednavkaUlozenaJidlo }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ objednavkaUlozenaJidlo <= 3 ? '130 Kč' : '145 Kč' }}
          </div>
          <q-btn flat dense label="Změnit" size="sm" color="grey" class="q-mt-sm"
            @click="objednavkaUlozena = false; objednavkaJidlo = objednavkaUlozenaJidlo"/>
        </div>

        <!-- Načítání cen -->
        <div v-if="objednavkaPricesLoading" class="text-center q-pa-md text-grey-6">
          <q-spinner size="2em" color="orange"/>
        </div>
        <div v-else-if="!objednavkaPrices && !objednavkaUlozena" class="q-mb-md q-pa-sm text-orange-8" style="background:#fff3e0;border-radius:4px">
          ⚠ Pro zítřejší datum nebyla nalezena cena oběda
        </div>

        <!-- Výběr jídla -->
        <div v-if="!objednavkaUlozena && objednavkaPrices">
          <div class="row q-gutter-md q-mb-md">
            <q-btn v-for="n in 4" :key="n"
              :unelevated="objednavkaJidlo === n"
              :outline="objednavkaJidlo !== n"
              :color="n <= 3 ? 'orange' : 'deep-orange'"
              class="col"
              style="height:72px"
              @click="objednavkaJidlo = n">
              <div class="text-center">
                <div style="font-size:1.6rem; font-weight:800; line-height:1">{{ n }}</div>
                <div style="font-size:0.65rem; opacity:0.85">
                  {{ n <= 3 || !objednavkaPrices.price2 ? objednavkaPrices.price1 : objednavkaPrices.price2 }} Kč
                </div>
              </div>
            </q-btn>
          </div>

          <div v-if="objednavkaJidlo" class="q-mb-md q-pa-sm text-center"
            style="background:#fff3e0; border-radius:4px">
            <div class="text-subtitle1">Jídlo č. <strong>{{ objednavkaJidlo }}</strong>
              — <strong>{{ objednavkaJidlo <= 3 || !objednavkaPrices.price2 ? objednavkaPrices.price1 : objednavkaPrices.price2 }} Kč</strong>
            </div>
          </div>

          <q-btn @click="saveObjednavka" label="Potvrdit objednávku" color="orange"
            :loading="objednavkaSaving" :disabled="!objednavkaJidlo"
            class="full-width" size="lg" icon="check"/>
        </div>

        <!-- Objednávky ostatních -->
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

// ── NEDOKONCENE-COMPONENT ─────────────────────────────────────────────────────
// Samostatná komponenta pro záložku Rozpracované v Nástrojích
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
    contractOptions() { return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] })); },
    jobOptions()      { return this.jobs.map(j => ({ label: j[1], value: j[0] })); },
    placeOptions()    { return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : []; }
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
        rowIndex: r[16], timeStart: Number(r[4]),
        timeEnd: null, timeEndStr: '',
        contractId: null, jobId: null, placeId: null, note: ''
      };
    },

    zrusitDoplneni() { this.doplnForm = null; },

    async ulozitDoplneni() {
      if (!this.doplnForm.contractId || !this.doplnForm.jobId || !this.doplnForm.placeId) {
        this.$emit('message', 'Vyplňte zakázku, práci a místo práce'); return;
      }
      if (!this.doplnForm.note || !this.doplnForm.note.trim()) {
        this.$emit('message', 'Poznámka je povinná'); return;
      }
      if (!this.doplnForm.timeEnd) {
        this.$emit('message', 'Zadejte čas odchodu'); return;
      }
      this.doplnSaving = true;
      try {
        const res = await apiCall('completerecord', {
          row_index: this.doplnForm.rowIndex,
          id_contract: this.doplnForm.contractId,
          id_worker: this.currentUser.id,
          id_job: this.doplnForm.jobId,
          id_place: this.doplnForm.placeId,
          time_fr: this.doplnForm.timeStart,
          time_to: this.doplnForm.timeEnd,
          note: this.doplnForm.note,
          opraveno: 'Y'
        });
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam doplněn a uložen');
          this.doplnForm = null;
          await this.loadNedokoncene();
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || ''));
        }
      } catch(e) { this.$emit('message', 'Chyba při ukládání'); }
      this.doplnSaving = false;
    },

    filterContracts(val, update) {
      update(() => {
        const n = val.toLowerCase();
        this.contractOptionsFiltered = val === '' ? this.contractOptions
          : this.contractOptions.filter(o => o.label.toLowerCase().includes(n));
      });
    },
    filterJobs(val, update) {
      update(() => {
        const n = val.toLowerCase();
        this.jobOptionsFiltered = val === '' ? this.jobOptions
          : this.jobOptions.filter(o => o.label.toLowerCase().includes(n));
      });
    },
    filterPlaces(val, update) {
      update(() => {
        const n = val.toLowerCase();
        this.placeOptionsFiltered = val === '' ? this.placeOptions
          : this.placeOptions.filter(o => o.label.toLowerCase().includes(n));
      });
    }
  },

  mounted() { this.loadNedokoncene(); },

  template: `
    <div class="q-pt-sm">
      <div class="q-mb-sm q-pa-xs text-caption text-orange-8" style="background:#fff3e0;border-radius:4px">
        ⚠ Záznamy kde chybí zakázka, práce nebo odchod. Doplňte je kdykoli.
      </div>

      <div v-if="nedokonceneLoading" class="text-center q-pa-md">
        <q-spinner color="orange" size="2em"/>
      </div>

      <div v-else-if="nedokoncene.length === 0" class="text-center text-grey-7 q-mt-lg">
        ✓ Žádné rozpracované záznamy
      </div>

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
                        const [h, m] = val.split(\':\');
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
          @filter="filterContracts" @focus="filterContracts(\'\', v => contractOptionsFiltered = contractOptions)"/>

        <q-select v-model="doplnForm.jobId" :options="jobOptionsFiltered"
          label="Práce *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterJobs" @focus="filterJobs(\'\', v => jobOptionsFiltered = jobOptions)"/>

        <q-select v-model="doplnForm.placeId" :options="placeOptionsFiltered"
          label="Místo práce *" emit-value map-options outlined class="q-mb-md"
          use-input hide-selected fill-input input-debounce="0"
          @filter="filterPlaces" @focus="filterPlaces(\'\', v => placeOptionsFiltered = placeOptions)"/>

        <q-input v-model="doplnForm.note" label="Poznámka *"
          outlined class="q-mb-md" type="textarea" rows="3"/>

        <div class="row q-gutter-sm">
          <q-btn @click="ulozitDoplneni" label="Uložit záznam" color="primary"
            :loading="doplnSaving" class="col" size="lg" unelevated/>
          <q-btn @click="zrusitDoplneni" label="Zpět" color="grey" outline size="lg"/>
        </div>
      </div>
    </div>
  `
});
