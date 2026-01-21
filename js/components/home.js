window.app.component('home-component', {
  props: ['currentUser', 'isAdmin', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      selectedContract: null,
      selectedJob: null,
      timeStart: null,
      timeEnd: null,
      note: '',
      working: false,
      contractKm: 0,
      kmManual: false,
      kmManualValue: null,
      kmRoundTrip: true,
      todayTripExists: false,
      todayTripInfo: null
    }
  },
  
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    
    contractName() {
      const c = this.contracts.find(x => x[0] === this.selectedContract);
      return c ? c[1] : '';
    },
    
    jobName() {
      const j = this.jobs.find(x => x[0] === this.selectedJob);
      return j ? j[1] : '';
    },
    
    calculatedKm() {
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
    async loadContractKm() {
      if (!this.isAdmin || !this.selectedContract) {
        this.contractKm = 0;
        return;
      }
      
      try {
        const res = await apiCall('getcontractkm', { id_contract: this.selectedContract });
        if (res.code === '000' && res.data) {
          this.contractKm = res.data.km || 0;
          
          const tripCheck = await apiCall('checktodaytrip', { id_contract: this.selectedContract });
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
    
    async startWork() {
      if (!this.selectedContract || !this.selectedJob) {
        this.$emit('message', '❌ Vyber zakázku a práci');
        return;
      }
      
      this.timeStart = Date.now();
      this.working = true;
      this.$emit('message', '✓ Směna zahájena');
    },
    
    async stopWork() {
      if (!this.working || !this.timeStart) {
        this.$emit('message', '❌ Nejdřív zahaj směnu');
        return;
      }
      
      this.timeEnd = Date.now();
      const hours = ((this.timeEnd - this.timeStart) / 3600000).toFixed(2);
      
      if (hours < 0.1) {
        this.$emit('message', '❌ Směna je příliš krátká');
        return;
      }
      
      try {
        const payload = {
          id_worker: this.currentUser.id,
          name_worker: this.currentUser.name,
          id_contract: this.selectedContract,
          name_contract: this.contractName,
          id_job: this.selectedJob,
          name_job: this.jobName,
          time_fr: this.timeStart,
          time_to: this.timeEnd,
          note: this.note
        };
        
        if (this.isAdmin && this.calculatedKm > 0) {
          payload.km_jednosmer = this.kmManual ? (this.kmManualValue || 0) : this.contractKm;
          payload.km_celkem = this.calculatedKm;
          payload.km_rucne = this.kmManual ? 'Y' : 'N';
        }
        
        const res = await apiCall('saverecord', payload);
        
        if (res.code === '000') {
          const kmText = this.calculatedKm > 0 ? ` (${this.calculatedKm} km)` : '';
          this.$emit('message', `✓ Směna ukončena: ${hours}h${kmText}`);
          this.resetForm();
          this.$emit('reload');
        } else {
          this.$emit('message', '❌ Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', '❌ Chyba při ukládání');
      }
    },
    
    resetForm() {
      this.selectedContract = null;
      this.selectedJob = null;
      this.timeStart = null;
      this.timeEnd = null;
      this.note = '';
      this.working = false;
      this.contractKm = 0;
      this.kmManual = false;
      this.kmManualValue = null;
      this.kmRoundTrip = true;
      this.todayTripExists = false;
      this.todayTripInfo = null;
    }
  },
  
  watch: {
    selectedContract() {
      if (this.isAdmin) {
        this.loadContractKm();
      }
    }
  },
  
  template: `
    <div class="q-pa-md">
      <div class="text-h5 q-mb-md">👷 Nová směna</div>
      
      <q-card>
        <q-card-section>
          <q-select
            v-model="selectedContract"
            :options="contractOptions"
            label="Zakázka *"
            emit-value
            map-options
            outlined
            :disable="working"
            class="q-mb-md"
          />
          
          <q-select
            v-model="selectedJob"
            :options="jobOptions"
            label="Práce *"
            emit-value
            map-options
            outlined
            :disable="working"
            class="q-mb-md"
          />
          
          <q-input
            v-model="note"
            label="Poznámka"
            outlined
            type="textarea"
            rows="2"
            :disable="working"
            class="q-mb-md"
          />
          
          <div v-if="isAdmin && contractKm > 0" class="q-mb-md">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle2">🚗 Kilometry</div>
                
                <q-banner v-if="todayTripExists" class="bg-orange-2 q-mt-sm" dense rounded>
                  ⚠️ Dnes už tam jel: {{ todayTripInfo.worker }} ({{ todayTripInfo.km }} km)
                </q-banner>
                
                <div class="q-mt-sm">
                  <div class="text-caption text-grey-7">
                    Místo: {{ contractName }} • {{ contractKm }} km jedna cesta
                  </div>
                  
                  <q-checkbox 
                    v-model="kmRoundTrip" 
                    label="Tam a zpět (×2)"
                    class="q-mt-sm"
                  />
                  
                  <div class="text-bold text-primary q-mt-xs">
                    Celkem: {{ calculatedKm }} km
                  </div>
                  
                  <q-checkbox 
                    v-model="kmManual" 
                    label="Zadat km ručně"
                    class="q-mt-sm"
                  />
                  
                  <q-input
                    v-if="kmManual"
                    v-model.number="kmManualValue"
                    label="Počet km"
                    type="number"
                    outlined
                    dense
                    class="q-mt-sm"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
          
          <div v-if="working" class="q-mb-md">
            <q-banner class="bg-blue-2" dense rounded>
              ⏱️ Pracuješ na: {{ contractName }} - {{ jobName }}
              <br>
              <span class="text-caption">Začátek: {{ new Date(timeStart).toLocaleTimeString('cs-CZ') }}</span>
            </q-banner>
          </div>
          
          <div class="row q-gutter-sm">
            <q-btn
              v-if="!working"
              @click="startWork"
              label="Zahájit směnu"
              color="green"
              icon="play_arrow"
              class="col"
              size="lg"
              unelevated
              :disable="!selectedContract || !selectedJob"
            />
            
            <q-btn
              v-if="working"
              @click="stopWork"
              label="Ukončit směnu"
              color="red"
              icon="stop"
              class="col"
              size="lg"
              unelevated
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  `
});
