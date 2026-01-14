// Vytvoření Vue aplikace - MUSÍ BÝT PŘED načtením komponent!
window.app = Vue.createApp({
  data() {
    return {
      isLoggedIn: false,
      currentUser: null,
      isAdmin: false,
      currentView: 'home',
      loading: false,
      message: '',
      showMessageDialog: false,
      
      // Data pro uživatele
      contracts: [],
      jobs: [],
      summary: null,
      records: [],
      advances: [],
      lunches: [],
      
      // Data pro admina
      allSummary: [],
      allRecords: [],
      allAdvances: []
    }
  },
  
  methods: {
    showMessage(msg) {
      this.message = msg;
      this.showMessageDialog = true;
      setTimeout(() => {
        this.message = '';
        this.showMessageDialog = false;
      }, 4000);
    },
    
    async handleLogin(code) {
      this.loading = true;
      try {
        // Načtení všech pracovníků
        const response = await apiCall('get', { type: 'workers' });
        
        if (response.success && response.data) {
          // Najít pracovníka podle kódu
          const worker = response.data.find(w => String(w[0]) === String(code));
          
          if (worker) {
            this.currentUser = {
              id: worker[0],
              name: worker[1],
              active: worker[2] === 'Y',
              admin: worker[3] === 'Y'
            };
            this.isLoggedIn = true;
            this.isAdmin = this.currentUser.admin;
            
            localStorage.setItem('userCode', code);
            
            // Načtení dat
            await this.loadUserData();
            if (this.isAdmin) {
              await this.loadAdminData();
            }
            
            this.showMessage('Přihlášení: ' + this.currentUser.name);
          } else {
            this.showMessage('Neplatný kód pracovníka');
          }
        } else {
          this.showMessage('Chyba při načítání dat');
        }
      } catch (error) {
        console.error('Login error:', error);
        this.showMessage('Chyba při přihlašování');
      } finally {
        this.loading = false;
      }
    },
    
    async loadUserData() {
      if (!this.currentUser) return;
      
      this.loading = true;
      try {
        // Načtení smluv
        const contractsRes = await apiCall('get', { type: 'contracts' });
        if (contractsRes.success && contractsRes.data) {
          this.contracts = contractsRes.data.map(c => ({
            id: c[0],
            name: c[1]
          }));
        }
        
        // Načtení prací
        const jobsRes = await apiCall('get', { type: 'jobs' });
        if (jobsRes.success && jobsRes.data) {
          this.jobs = jobsRes.data.map(j => ({
            id: j[0],
            name: j[1]
          }));
        }
        
        // Načtení souhrnu financí
        const summaryRes = await apiCall('getsummary', { 
          workerId: this.currentUser.id 
        });
        if (summaryRes.success) {
          this.summary = summaryRes.data;
        }
        
        // Načtení záznamů
        const recordsRes = await apiCall('getrecords', { 
          workerId: this.currentUser.id 
        });
        if (recordsRes.success) {
          this.records = recordsRes.data || [];
        }
        
        // Načtení záloh
        const advancesRes = await apiCall('getadvances', { 
          workerId: this.currentUser.id 
        });
        if (advancesRes.success) {
          this.advances = advancesRes.data || [];
        }
        
        // Načtení obědů (pokud existuje akce)
        // const lunchesRes = await apiCall('getlunches', { 
        //   workerId: this.currentUser.id 
        // });
        // if (lunchesRes.success) {
        //   this.lunches = lunchesRes.data || [];
        // }
        
      } catch (error) {
        console.error('Error loading user data:', error);
        this.showMessage('Chyba při načítání dat');
      } finally {
        this.loading = false;
      }
    },
    
    async loadAdminData() {
      if (!this.isAdmin) return;
      
      this.loading = true;
      try {
        // Načtení všech souhrnů
        const summaryRes = await apiCall('getallsummary');
        if (summaryRes.success) {
          this.allSummary = summaryRes.data || [];
        }
        
        // Načtení všech záznamů
        const recordsRes = await apiCall('getallrecords');
        if (recordsRes.success) {
          this.allRecords = recordsRes.data || [];
        }
        
        // Načtení všech záloh
        const advancesRes = await apiCall('getalladvances');
        if (advancesRes.success) {
          this.allAdvances = advancesRes.data || [];
        }
        
      } catch (error) {
        console.error('Error loading admin data:', error);
        this.showMessage('Chyba při načítání admin dat');
      } finally {
        this.loading = false;
      }
    },
    
    logout() {
      this.isLoggedIn = false;
      this.currentUser = null;
      this.isAdmin = false;
      this.currentView = 'home';
      this.contracts = [];
      this.jobs = [];
      this.summary = null;
      this.records = [];
      this.advances = [];
      this.lunches = [];
      this.allSummary = [];
      this.allRecords = [];
      this.allAdvances = [];
      
      localStorage.removeItem('userCode');
      this.showMessage('Odhlášení úspěšné');
    }
  },
  
  async mounted() {
    // Auto-login z localStorage
    const savedCode = localStorage.getItem('userCode');
    if (savedCode) {
      await this.handleLogin(savedCode);
    }
  }
});

// Mount aplikace až po načtení všech komponent
// Čekáme až se načtou všechny komponenty
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app.use(Quasar);
    window.app.mount('#app');
  });
} else {
  window.app.use(Quasar);
  window.app.mount('#app');
}
