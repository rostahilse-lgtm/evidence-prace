// Komponenta pro přehledy (Finance, Záznamy, Obědy, Zálohy)
window.app.component('summary-component', {
  props: ['summary', 'records', 'advances', 'lunches'],
  emits: ['message'],
  
  data() {
    return {
      summaryTab: 'finances',
      useDateFilter: false,
      dateFrom: getMonthStart(),
      dateTo: getTodayDate()
    }
  },
  
  computed: {
    filteredRecords() {
      if (!this.useDateFilter) return this.records;
      return this.records.filter(r => {
        return r.date >= this.dateFrom && r.date <= this.dateTo;
      });
    },
    
    filteredAdvances() {
      if (!this.useDateFilter) return this.advances;
      return this.advances.filter(a => {
        return a.date >= this.dateFrom && a.date <= this.dateTo;
      });
    },
    
    filteredLunches() {
      if (!this.useDateFilter) return this.lunches;
      return this.lunches.filter(l => {
        return l.date >= this.dateFrom && l.date <= this.dateTo;
      });
    },
    
    filteredSummary() {
      if (!this.useDateFilter || !this.summary) return this.summary;
      
      const filtered = this.filteredRecords;
      const totalHours = filtered.reduce((sum, r) => sum + (r.hours || 0), 0);
      const totalEarnings = filtered.reduce((sum, r) => sum + (r.earnings || 0), 0);
      const totalAdvances = this.filteredAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
      const totalLunches = this.filteredLunches.length * 100;
      
      return {
        totalHours,
        totalEarnings,
        totalAdvances,
        totalLunches,
        balance: totalEarnings - totalAdvances - totalLunches
      };
    }
  },
  
  template: `
    <div>
      <!-- Date Filter -->
      <q-card class="q-mb-md">
        <q-card-section>
          <q-toggle
            v-model="useDateFilter"
            label="Filtrovat podle data"
          />
          
          <div v-if="useDateFilter" class="row q-gutter-md q-mt-sm">
            <q-input
              v-model="dateFrom"
              type="date"
              label="Od"
              outlined
              dense
              class="col"
            />
            <q-input
              v-model="dateTo"
              type="date"
              label="Do"
              outlined
              dense
              class="col"
            />
          </div>
        </q-card-section>
      </q-card>
      
      <!-- Tabs -->
      <q-tabs v-model="summaryTab" dense align="justify" class="q-mb-md">
        <q-tab name="finances" icon="account_balance" label="Finance" />
        <q-tab name="records" icon="list" label="Záznamy" />
        <q-tab name="lunches" icon="restaurant" label="Obědy" />
        <q-tab name="advances" icon="payments" label="Zálohy" />
      </q-tabs>
      
      <!-- Finance -->
      <div v-if="summaryTab === 'finances'">
        <q-card>
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label>Celkem hodin</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label>{{ filteredSummary?.totalHours || 0 }} h</q-item-label>
              </q-item-section>
            </q-item>
            
            <q-separator />
            
            <q-item>
              <q-item-section>
                <q-item-label>Celkem výdělek</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label class="text-positive">{{ filteredSummary?.totalEarnings || 0 }} Kč</q-item-label>
              </q-item-section>
            </q-item>
            
            <q-separator />
            
            <q-item>
              <q-item-section>
                <q-item-label>Zálohy</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label class="text-negative">-{{ filteredSummary?.totalAdvances || 0 }} Kč</q-item-label>
              </q-item-section>
            </q-item>
            
            <q-separator />
            
            <q-item>
              <q-item-section>
                <q-item-label>Obědy</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label class="text-negative">-{{ filteredSummary?.totalLunches || 0 }} Kč</q-item-label>
              </q-item-section>
            </q-item>
            
            <q-separator />
            
            <q-item>
              <q-item-section>
                <q-item-label class="text-weight-bold">K výplatě</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label class="text-weight-bold text-h6">
                  {{ filteredSummary?.balance || 0 }} Kč
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
      
      <!-- Záznamy -->
      <div v-if="summaryTab === 'records'">
        <q-list bordered separator v-if="filteredRecords.length">
          <q-item v-for="record in filteredRecords" :key="record.id">
            <q-item-section>
              <q-item-label>{{ record.date }}</q-item-label>
              <q-item-label caption>{{ record.contractName }} - {{ record.jobName }}</q-item-label>
              <q-item-label caption>{{ formatTime(record.startTime) }} - {{ formatTime(record.endTime) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label>{{ record.hours }} h</q-item-label>
              <q-item-label caption>{{ record.earnings }} Kč</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-card v-else>
          <q-card-section>
            <div class="text-center text-grey">Žádné záznamy</div>
          </q-card-section>
        </q-card>
      </div>
      
      <!-- Obědy -->
      <div v-if="summaryTab === 'lunches'">
        <q-list bordered separator v-if="filteredLunches.length">
          <q-item v-for="lunch in filteredLunches" :key="lunch.id">
            <q-item-section>
              <q-item-label>{{ lunch.date }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label>100 Kč</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-card v-else>
          <q-card-section>
            <div class="text-center text-grey">Žádné obědy</div>
          </q-card-section>
        </q-card>
      </div>
      
      <!-- Zálohy -->
      <div v-if="summaryTab === 'advances'">
        <q-list bordered separator v-if="filteredAdvances.length">
          <q-item v-for="advance in filteredAdvances" :key="advance.id">
            <q-item-section>
              <q-item-label>{{ advance.date }}</q-item-label>
              <q-item-label caption v-if="advance.note">{{ advance.note }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label>{{ advance.amount }} Kč</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-card v-else>
          <q-card-section>
            <div class="text-center text-grey">Žádné zálohy</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  `
});
