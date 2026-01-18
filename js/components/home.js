// Komponenta pro domovskou stránku (Směna, Oběd, Záloha)
app.component('home-component', {
  props: ['currentUser', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      currentTab: 'shift',
      
      // Formulář směny - PŮVODNÍ LOGIKA
      shiftForm: {
        contractId: null,
        jobId: null,
        timeStart: null,
        timeEnd: null,
        note: ''
      },
      
      // Formulář zálohy
      advanceForm: {
        amount: null,
        reason: ''
      }
    }
  },
  
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: `${c[0]} - ${c[1]}`, value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    }
  },
  
  methods: {
    // === SMĚNA - PŮVODNÍ LOGIKA ===
    
    setArrival() {
      this.shiftForm.timeStart = Date.now();
      this.saveShiftState();
      this.$emit('message', 'Příchod: ' + formatTime(this.shiftForm.timeStart));
    },
    
    setDeparture() {
      if (!this.shiftForm.timeStart) {
        this.$emit('message', 'Nejdříve zaznamenejte příchod');
        return;
      }
      this.shiftForm.timeEnd = Date.now();
      this.saveShiftState();
      this.$emit('message', 'Odchod: ' + formatTime(this.shiftForm.timeEnd));
    },
    
    async saveShift() {
      // VALIDACE - PŮVODNÍ
      if (!this.shiftForm.contractId || !this.shiftForm.jobId || !this.shiftForm.timeStart || !this.shiftForm.timeEnd) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      // VALIDACE POZNÁMKY - TOTO CHYBĚLO!
      if (!this.shiftForm.note || this.shiftForm.note.trim() === '') {
        this.$emit('message', 'Poznámka je povinná');
        return;
      }
      
      try {
        const res = await apiCall('saverecord', {
          id_contract: this.shiftForm.contractId,
          id_worker: this.currentUser.id,
          id_job: this.shiftForm.jobId,
          time_fr: this.shiftForm.timeStart,
          time_to: this.shiftForm.timeEnd,
          note: this.shiftForm.note
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Směna uložena');
          this.clearShiftState();
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save shift error:', error);
        this.$emit('message', 'Chyba při ukládání směny');
      }
    },
    
    // === LOCALSTORAGE - PŮVODNÍ LOGIKA ===
    
    saveShiftState() {
      const state = {
        timeStart: this.shiftForm.timeStart,
        timeEnd: this.shiftForm.timeEnd,
        contractId: this.shiftForm.contractId,
        jobId: this.shiftForm.jobId,
        note: this.shiftForm.note,
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
          this.shiftForm.note = state.note;
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
        timeStart: null,
        timeEnd: null,
        note: ''
      };
    },
    
    // === OBĚD - PŮVODNÍ LOGIKA ===
    
    async saveLunch() {
      try {
        const res = await apiCall('savelunch', {
          id_worker: this.currentUser.id,
          name_worker: this.currentUser.name,
          time: Date.now()
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Oběd uložen');
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save lunch error:', error);
        this.$emit('message', 'Chyba při ukládání oběda');
      }
    },
    
    // === ZÁLOHA - PŮVODNÍ LOGIKA ===
    
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
        console.error('Save advance error:', error);
        this.$emit('message', 'Chyba při ukládání zálohy');
      }
    }
  },
  
  formatTime(t) { return formatTime(t); },
  formatShortDateTime(t) { return formatShortDateTime(t); },
  getTodayDate() { return getTodayDate(); }
},
  
  watch: {
  // === WATCH - PŮVODNÍ LOGIKA ===
  watch: {
    'shiftForm.contractId'() { this.saveShiftState(); },
    'shiftForm.jobId'() { this.saveShiftState(); },
    'shiftForm.note'() { this.saveShiftState(); }
  },
  
  mounted() {
    this.loadShiftState();
  },
  
  // === TEMPLATE - PŮVODNÍ DESIGN ===
  template: `
    <div>
      <q-tabs v-model="currentTab" dense align="justify" class="text-primary">
        <q-tab name="shift" label="Směna"/>
        <q-tab name="lunch" label="Oběd"/>
        <q-tab name="advance" label="Záloha"/>
      </q-tabs>

      <!-- SMĚNA -->
      <div v-if="currentTab === 'shift'" class="q-pt-md">
        <q-btn 
          @click="setArrival" 
          color="green" 
          icon="login" 
          label="PŘÍCHOD" 
          class="full-width q-mb-md time-btn" 
          :disabled="shiftForm.timeStart"
        />
        
        <div v-if="shiftForm.timeStart" class="q-mb-md q-pa-sm" style="background: #e8f5e9; border-radius: 4px;">
          <div class="text-bold text-green-8">✓ Příchod zaznamenán</div>
          <div>{{ formatShortDateTime(shiftForm.timeStart) }}</div>
        </div>
        
        <q-btn 
          @click="setDeparture" 
          color="orange" 
          icon="logout" 
          label="ODCHOD" 
          class="full-width q-mb-md time-btn" 
          :disabled="!shiftForm.timeStart || shiftForm.timeEnd"
        />
        
        <div v-if="shiftForm.timeEnd" class="q-mb-md q-pa-sm" style="background: #fff3e0; border-radius: 4px;">
          <div class="text-bold text-orange-8">✓ Odchod zaznamenán</div>
          <div>{{ formatShortDateTime(shiftForm.timeEnd) }}</div>
          <div class="text-primary text-bold q-mt-sm">
            Odpracováno: {{ ((shiftForm.timeEnd - shiftForm.timeStart) / 3600000).toFixed(2) }} hod
          </div>
        </div>
        
        <q-select 
          v-model="shiftForm.contractId" 
          :options="contractOptions" 
          label="Zakázka *" 
          emit-value 
          map-options 
          outlined 
          class="q-mb-md"
        />
        
        <q-select 
          v-model="shiftForm.jobId" 
          :options="jobOptions" 
          label="Práce *" 
          emit-value 
          map-options 
          outlined 
          class="q-mb-md"
        />
        
        <q-input 
          v-model="shiftForm.note" 
          label="Poznámka *" 
          outlined 
          class="q-mb-md" 
          type="textarea" 
          rows="3"
        />
        
        <q-btn 
          @click="saveShift" 
          label="Uložit směnu" 
          color="primary" 
          :loading="loading" 
          class="full-width" 
          size="lg"
        />
      </div>

      <!-- OBĚD -->
      <div v-if="currentTab === 'lunch'" class="q-pt-md">
        <div class="text-center q-mb-md">
          <q-icon name="restaurant" size="4rem" color="orange"/>
          <div class="text-h6 q-mt-md">{{ getTodayDate() }}</div>
        </div>
        <q-btn 
          @click="saveLunch" 
          label="Uložit oběd" 
          color="orange" 
          :loading="loading" 
          class="full-width" 
          size="lg" 
          icon="restaurant"
        />
      </div>

      <!-- ZÁLOHA -->
      <div v-if="currentTab === 'advance'" class="q-pt-md">
        <q-input 
          v-model.number="advanceForm.amount" 
          label="Částka (Kč) *" 
          type="number" 
          outlined 
          class="q-mb-md"
        />
        <q-input 
          v-model="advanceForm.reason" 
          label="Důvod *" 
          outlined 
          class="q-mb-md" 
          type="textarea" 
          rows="2"
        />
        <q-btn 
          @click="saveAdvance" 
          label="Uložit zálohu" 
          color="primary" 
          :loading="loading" 
          class="full-width" 
          size="lg"
        />
      </div>
    </div>
  `
});
