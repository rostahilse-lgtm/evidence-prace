// Komponenta pro domovskou stránku (Směna, Oběd, Záloha)
window.app.component('home-component', {
  props: ['currentUser', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      currentTab: 'shift',
      
      // Formulář směny
      shiftForm: {
        contractId: null,
        jobId: null,
      },
      activeShift: null,
      
      // Formulář oběda
      lunchDate: getTodayDate(),
      
      // Formulář zálohy
      advanceAmount: null,
      advanceNote: ''
    }
  },
  
  methods: {
    async startShift() {
      if (!this.shiftForm.contractId || !this.shiftForm.jobId) {
        this.$emit('message', 'Vyberte smlouvu a práci');
        return;
      }
      
      try {
        const response = await apiCall('startShift', {
          workerId: this.currentUser.id,
          contractId: this.shiftForm.contractId,
          jobId: this.shiftForm.jobId
        });
        
        if (response.success) {
          this.activeShift = response.shift;
          this.$emit('message', 'Směna zahájena');
          this.$emit('reload');
        } else {
          this.$emit('message', response.message || 'Chyba při zahájení směny');
        }
      } catch (error) {
        console.error('Start shift error:', error);
        this.$emit('message', 'Chyba při zahájení směny');
      }
    },
    
    async endShift() {
      if (!this.activeShift) return;
      
      try {
        const response = await apiCall('endShift', {
          shiftId: this.activeShift.id
        });
        
        if (response.success) {
          this.activeShift = null;
          this.$emit('message', 'Směna ukončena');
          this.$emit('reload');
        } else {
          this.$emit('message', response.message || 'Chyba při ukončení směny');
        }
      } catch (error) {
        console.error('End shift error:', error);
        this.$emit('message', 'Chyba při ukončení směny');
      }
    },
    
    async addLunch() {
      if (!this.lunchDate) {
        this.$emit('message', 'Vyberte datum');
        return;
      }
      
      try {
        const response = await apiCall('addLunch', {
          workerId: this.currentUser.id,
          date: this.lunchDate
        });
        
        if (response.success) {
          this.$emit('message', 'Oběd přidán');
          this.$emit('reload');
          this.lunchDate = getTodayDate();
        } else {
          this.$emit('message', response.message || 'Chyba při přidání oběda');
        }
      } catch (error) {
        console.error('Add lunch error:', error);
        this.$emit('message', 'Chyba při přidání oběda');
      }
    },
    
    async addAdvance() {
      if (!this.advanceAmount || this.advanceAmount <= 0) {
        this.$emit('message', 'Zadejte platnou částku');
        return;
      }
      
      try {
        const response = await apiCall('addAdvance', {
          workerId: this.currentUser.id,
          amount: this.advanceAmount,
          note: this.advanceNote
        });
        
        if (response.success) {
          this.$emit('message', 'Záloha přidána');
          this.$emit('reload');
          this.advanceAmount = null;
          this.advanceNote = '';
        } else {
          this.$emit('message', response.message || 'Chyba při přidání zálohy');
        }
      } catch (error) {
        console.error('Add advance error:', error);
        this.$emit('message', 'Chyba při přidání zálohy');
      }
    },
    
    async checkActiveShift() {
      try {
        const response = await apiCall('getActiveShift', {
          workerId: this.currentUser.id
        });
        
        if (response.success && response.shift) {
          this.activeShift = response.shift;
        }
      } catch (error) {
        console.error('Check active shift error:', error);
      }
    }
  },
  
  mounted() {
    this.checkActiveShift();
  },
  
  template: `
    <div>
      <q-tabs v-model="currentTab" dense align="justify" class="q-mb-md">
        <q-tab name="shift" icon="schedule" label="Směna" />
        <q-tab name="lunch" icon="restaurant" label="Oběd" />
        <q-tab name="advance" icon="payments" label="Záloha" />
      </q-tabs>
      
      <!-- Směna -->
      <div v-if="currentTab === 'shift'">
        <q-card v-if="!activeShift">
          <q-card-section>
            <div class="text-h6">Zahájit směnu</div>
          </q-card-section>
          
          <q-card-section>
            <q-select
              v-model="shiftForm.contractId"
              :options="contracts"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Smlouva"
              outlined
              class="q-mb-md"
            />
            
            <q-select
              v-model="shiftForm.jobId"
              :options="jobs"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Práce"
              outlined
            />
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn
              color="primary"
              label="Zahájit"
              @click="startShift"
              :disable="!shiftForm.contractId || !shiftForm.jobId"
              unelevated
            />
          </q-card-actions>
        </q-card>
        
        <q-card v-else class="bg-green-1">
          <q-card-section>
            <div class="text-h6">Aktivní směna</div>
            <div class="text-subtitle2">Začátek: {{ formatTime(activeShift.startTime) }}</div>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn
              color="negative"
              label="Ukončit směnu"
              @click="endShift"
              unelevated
            />
          </q-card-actions>
        </q-card>
      </div>
      
      <!-- Oběd -->
      <div v-if="currentTab === 'lunch'">
        <q-card>
          <q-card-section>
            <div class="text-h6">Přidat oběd</div>
          </q-card-section>
          
          <q-card-section>
            <q-input
              v-model="lunchDate"
              type="date"
              label="Datum"
              outlined
            />
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn
              color="primary"
              label="Přidat"
              @click="addLunch"
              :disable="!lunchDate"
              unelevated
            />
          </q-card-actions>
        </q-card>
      </div>
      
      <!-- Záloha -->
      <div v-if="currentTab === 'advance'">
        <q-card>
          <q-card-section>
            <div class="text-h6">Přidat zálohu</div>
          </q-card-section>
          
          <q-card-section>
            <q-input
              v-model.number="advanceAmount"
              type="number"
              label="Částka (Kč)"
              outlined
              class="q-mb-md"
            />
            
            <q-input
              v-model="advanceNote"
              label="Poznámka (volitelné)"
              outlined
            />
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn
              color="primary"
              label="Přidat"
              @click="addAdvance"
              :disable="!advanceAmount || advanceAmount <= 0"
              unelevated
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  `
});
