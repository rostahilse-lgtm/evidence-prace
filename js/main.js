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
        const response = await apiCall('login', { code });
        
        if (response.success && response.user) {
          this.currentUser = response.user;
          this.isLoggedIn = true;
          this.isAdmin = response.user.isAdmin || false;
          
          localStorage.setItem('userCode', code);
          
          // Načtení dat
          await this.loadUserData();
          if (this.isAdmin) {
            await this.loadAdminData();
          }
          
          this.showMessage('Přihlášení úspěšné!');
        } else {
          this.showMessage('Neplatný přihlašovací kód');
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
        // Načtení smluv a prací
        const contractsRes = await apiCall('getContracts');
        this.contracts = contractsRes.contracts || [];
        
        const jobsRes = await apiCall('getJobs');
        this.jobs = jobsRes.jobs || [];
        
        // Načtení souhrnu
        const summaryRes = await apiCall('getSummary', { 
          workerId: this.currentUser.id 
        });
        this.summary = summaryRes.summary || null;
        
        // Načtení záznamů
        const recordsRes = await apiCall('getRecords', { 
          workerId: this.currentUser.id 
        });
        this.records = recordsRes.records || [];
        
        // Načtení záloh
        const advancesRes = await apiCall('getAdvances', { 
          workerId: this.currentUser.id 
        });
        this.advances = advancesRes.advances || [];
        
        // Načtení obědů
        const lunchesRes = await apiCall('getLunches', { 
          workerId: this.currentUser.id 
        });
        this.lunches = lunchesRes.lunches || [];
        
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
        const summaryRes = await apiCall('getAllSummary');
        this.allSummary = summaryRes.summary || [];
        
        // Načtení všech záznamů
        const recordsRes = await apiCall('getAllRecords');
        this.allRecords = recordsRes.records || [];
        
        // Načtení všech záloh
        const advancesRes = await apiCall('getAllAdvances');
        this.allAdvances = advancesRes.advances || [];
        
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
