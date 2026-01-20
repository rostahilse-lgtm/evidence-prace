app.component('kilometers-component', {
  props: ['currentUser'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      kmForm: {
        kilometers: null,
        note: '',
        contractId: null
      },
      contracts: []
    }
  },
  
  async mounted() {
    const res = await apiCall('get', { type: 'contracts' });
    if (res.data) this.contracts = res.data;
  },
  
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    }
  },
  
  methods: {
    async saveKilometers() {
      if (!this.kmForm.kilometers || !this.kmForm.contractId) {
        this.$emit('message', 'Vyplňte kilometry a zakázku');
        return;
      }
      
      try {
        const res = await apiCall('saveadvance', {
          id_worker: this.currentUser.id,
          name_worker: this.currentUser.name,
          time: Date.now(),
          payment: this.kmForm.kilometers * 4,
          payment_reason: 'Kilometry: ' + this.kmForm.kilometers + ' km' + (this.kmForm.note ? ' - ' + this.kmForm.note : '')
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Kilometry uloženy (' + (this.kmForm.kilometers * 4) + ' Kč)');
          this.kmForm = { kilometers: null, note: '', contractId: null };
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání');
      }
    }
  },
  
  template: '<div class="q-pa-md"><h6 class="q-mt-none">Evidence kilometrů</h6><q-select v-model="kmForm.contractId" :options="contractOptions" label="Zakázka *" emit-value map-options outlined class="q-mb-md"/><q-input v-model.number="kmForm.kilometers" label="Počet km *" type="number" outlined class="q-mb-md" hint="Náhrada: 4 Kč/km"/><q-input v-model="kmForm.note" label="Poznámka (volitelné)" outlined class="q-mb-md" type="textarea" rows="2" placeholder="např. Opava - Ostrava"/><q-btn @click="saveKilometers" label="Uložit kilometry" color="primary" class="full-width" size="lg"/></div>'
});
