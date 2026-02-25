// home.js
// v2026-02-25b - Oprava: česká lokalizace datumů (csLocale objekt), oprava UNDEFINED ceny oběda
//              - nic jsem nesmazal, pouze opravil chyby co nefungovaly

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
      // OBĚD - nové
      lunchDate: '',        // DD. MM. YYYY - default se nastaví v mounted
      lunchPrice: null,     // vybraná cena v Kč
      lunchPrices: null,    // { price1: 99, price2: 145 } z GAS
      lunchPricesLoading: false
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
    // Česká lokalizace pro q-date (locale="cs" jako string nefunguje, musí být objekt)
    csLocale() {
      return {
        days: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
        daysShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
        months: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
        monthsShort: ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'],
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
    // ── OBĚD - pomocné ─────────────────────────────────────
    getTodayFormatted() {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}. ${mm}. ${d.getFullYear()}`;
    },

    lunchDateToTimestamp(dateStr) {
      // DD. MM. YYYY → timestamp poledne
      const parts = dateStr.split('. ');
      return new Date(parts[2], parts[1] - 1, parts[0], 12, 0).getTime();
    },

    async loadLunchPrices(dateStr) {
      this.lunchPricesLoading = true;
      this.lunchPrice = null;  // reset vybrané ceny při změně datumu
      try {
        const ts = this.lunchDateToTimestamp(dateStr);
        const res = await apiCall('getlunchprice', { date: ts });
        // Validace: res.data musí existovat A mít price1 (číslo > 0)
        if (res.code === '000' && res.data && res.data.price1 != null && res.data.price1 !== '') {
          this.lunchPrices = res.data;  // { price1: 99, price2: 145 }
          // automaticky vyber první cenu
          this.lunchPrice = res.data.price1;
        } else {
          this.lunchPrices = null;
        }
      } catch (e) {
        this.lunchPrices = null;
      }
      this.lunchPricesLoading = false;
    },

    // ── SMĚNA ──────────────────────────────────────────────
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
        if (state.date === getTodayDate()) {
          this.shiftForm.timeStart = state.timeStart;
          this.shiftForm.timeEnd = state.timeEnd;
          this.shiftForm.contractId = state.contractId;
          this.shiftForm.jobId = state.jobId;
          this.shiftForm.placeId = state.placeId;
          this.shiftForm.note = state.note;
          this.cloudRowIndex = state.cloudRowIndex || null;
        } else {
          this.clearShiftState();
        }
      }
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
    
    // ── OBĚD - ukládání ────────────────────────────────────
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
          payment: this.lunchPrice  // ← cena oběda
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
    
    // ── ZÁLOHA ─────────────────────────────────────────────
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
    // při změně datumu oběda načti nové ceny
    lunchDate(newDate) {
      if (newDate) this.loadLunchPrices(newDate);
    }
  },
  
  mounted() {
    this.loadShiftState();
    this.lunchDate = this.getTodayFormatted();  // default = dnes
    this.loadLunchPrices(this.lunchDate);
  },
  
  template: `
    <div>
      <q-tabs v-model="currentTab" dense align="justify" class="text-primary">
        <q-tab name="shift" label="Směna"/>
        <q-tab name="lunch" label="Oběd"/>
        <q-tab name="advance" label="Záloha"/>
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
        
        <q-select v-model="shiftForm.contractId" :options="contractOptions"
          label="Zakázka *" emit-value map-options outlined class="q-mb-md"/>
        
        <q-select v-model="shiftForm.jobId" :options="jobOptions"
          label="Práce *" emit-value map-options outlined class="q-mb-md"/>
        
        <q-select v-model="shiftForm.placeId" :options="placeOptions"
          label="Místo práce *" emit-value map-options outlined class="q-mb-md"/>
        
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

        <!-- výběr datumu -->
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

        <!-- ceny - loading -->
        <div v-if="lunchPricesLoading" class="text-center q-pa-md text-grey-6">
          <q-spinner size="2em" color="orange"/>
          <div class="q-mt-sm">Načítám ceny...</div>
        </div>

        <!-- ceny - nenalezeny -->
        <div v-else-if="!lunchPrices" class="q-mb-md q-pa-sm text-orange-8" style="background:#fff3e0;border-radius:4px">
          ⚠ Pro vybrané datum nebyla nalezena cena oběda
        </div>

        <!-- ceny - výběr -->
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

        <!-- zobrazení vybrané ceny -->
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
    </div>
  `
});
