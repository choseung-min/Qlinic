<template>
    <section class="medicine-collection">
        <div class="page-header">
            <h1>Medicine Collection</h1>
            <p>Track and update medicine collection status</p>
        </div>

        <p v-if="loading" class="page-message">
            Loading medicine collection records...
        </p>

        <p v-else-if="errorMessage" class="page-message error-message">
            {{ errorMessage }}
        </p>

        <p v-else-if="medicineVisits.length === 0" class="page-message">
            No medicine collection records found for today
        </p>

        <div v-else class="medicine-list">
            <div v-for="visit in medicineVisits" :key="visit.id" class="medicine-card">

                <div class="medicine-info">
                    <div class="medicine-icon">
                        💊
                    </div>

                    <div class="patient-details">
                        <div class="patient-heading">
                            <h2>{{ visit.patientName }}</h2>
                            <span class="queue-number">
                                {{ formatQueueNumber(visit.queueNumber) }}
                            </span>
                        </div>

                        <div class="status-row">
                            <span class="status-badge" :class="medicineStatusClass(visit.medicineStatus)">
                                {{ formatMedicineStatus(visit.medicineStatus) }}
                            </span>

                            <span class="status-badge" :class="visitStatusClass(visit.visitStatus)">
                                {{ visit.visitStatus }}
                            </span>
                        </div>

                        <p class="prescription">
                            Rx: {{ visit.prescription || 'Not available' }}
                        </p>
                    </div>
                </div>

                <!-- 7B medicine collection actions -->
                <div class="medicine-actions">
                    <button v-if="isPreparing(visit.medicineStatus)" type="button"
                        class="button-ready" disabled>
                        Mark Ready
                    </button>

                    <button v-else-if="isReady(visit.medicineStatus)" type="button"
                        class="button-collected" disabled>
                        Mark Collected
                    </button>

                    <span v-else-if="isCollected(visit.medicineStatus)" class="collected-label">
                        Collected
                    </span>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import { auth, db } from '@/services/firebase.js';

export default {
    name: 'MedicineCollection',

    data() {
        return {
            medicineVisits: [],
            today: '',
            loading: true,
            errorMessage: '',
            unsubscribeAuth: null,
            unsubscribeVisits: null,
            loadVersion: 0
        };
    },

    mounted() {
        this.today = this.formatDate(new Date());

        this.unsubscribeAuth = auth.onAuthStateChanged((user) => {
            this.stopListening();
            this.medicineVisits = [];
            this.errorMessage = '';

            if (user) {
                this.listenForMedicineVisits();
            } else {
                this.loading = false;
                this.errorMessage = 'Please log in to view medicine collection';
            }
        });
    },

    beforeUnmount() {
        this.stopListening();

        if (this.unsubscribeAuth) {
            this.unsubscribeAuth();
        }
    },

    methods: {
        // 7A retrieve medicine collection records for today's visits
        listenForMedicineVisits() {
            this.loading = true;

            this.unsubscribeVisits = db.collection('visits')
                .where('visitDate', '==', this.today)
                .onSnapshot(async (snapshot) => {
                    const version = ++this.loadVersion;

                    try {
                        const rows = [];
                        const patientNames = {};

                        for (const document of snapshot.docs) {
                            const visit = document.data();

                            // retrieve visits that require or have completed medicine collection
                            if (!this.isMedicineVisit(visit)) {
                                continue;
                            }

                            let patientName = visit.patientName || '';

                            // retrieve patient name if not stored in visit
                            if (!patientName && visit.patientId) {
                                if (patientNames[visit.patientId]) {
                                    patientName = patientNames[visit.patientId];
                                } else {
                                    try {
                                        const patientDoc = await db.collection('patients')
                                            .doc(visit.patientId)
                                            .get();

                                        if (patientDoc.exists) {
                                            const patient = patientDoc.data();

                                            patientName = patient.displayName ||
                                                patient.fullName ||
                                                patient.name ||
                                                [patient.firstName, patient.lastName]
                                                    .filter(Boolean)
                                                    .join(' ');
                                        }
                                    } catch (error) {
                                        console.warn(
                                            'Unable to retrieve patient name:',
                                            error
                                        );
                                    }

                                    patientNames[visit.patientId] =
                                        patientName || 'Patient name unavailable';
                                }
                            }

                            // retrieve medicine status and prescription details
                            const medicineStatus = visit.medicineStatus ||
                                visit.medicineCollectionStatus || '';

                            const prescription = this.getPrescription(visit);

                            rows.push({
                                id: document.id,
                                patientName: patientName || 'Patient name unavailable',
                                queueNumber: visit.queueNumber,
                                queueOrder: visit.queueOrder,
                                visitStatus: visit.visitStatus || 'Unknown',
                                medicineStatus: medicineStatus,
                                prescription: prescription
                            });
                        }

                        // display medicine collection patients according to queue order
                        rows.sort((a, b) => {
                            return this.queueValue(a.queueOrder ?? a.queueNumber) -
                                this.queueValue(b.queueOrder ?? b.queueNumber);
                        });

                        if (version === this.loadVersion && auth.currentUser) {
                            this.medicineVisits = rows;
                            this.errorMessage = '';
                            this.loading = false;
                        }

                    } catch (error) {
                        console.error('Error loading medicine collection:', error);

                        if (version === this.loadVersion) {
                            this.errorMessage = 'Unable to load medicine collection';
                            this.loading = false;
                        }
                    }
                }, (error) => {
                    console.error('Error listening for medicine collection:', error);

                    this.errorMessage = 'Unable to load medicine collection';
                    this.loading = false;
                });
        },

        // 7A identify visits with medicine collection records
        isMedicineVisit(visit) {
            const visitStatus = String(visit.visitStatus || '')
                .trim()
                .toLowerCase();

            const medicineStatus = String(
                visit.medicineStatus || visit.medicineCollectionStatus || ''
            ).trim().toLowerCase();

            return visitStatus === 'awaiting medicine' ||
                ['preparing', 'ready', 'ready for collection', 'collected']
                    .includes(medicineStatus);
        },

        // 7A retrieve prescription text when available in the visit
        getPrescription(visit) {
            const prescription = visit.prescription ||
                visit.medication ||
                visit.medicationDetails || '';

            if (typeof prescription === 'string') {
                return prescription.trim();
            }

            if (Array.isArray(prescription)) {
                return prescription.filter((item) => typeof item === 'string')
                    .join(', ');
            }

            return '';
        },

        stopListening() {
            this.loadVersion++;

            if (this.unsubscribeVisits) {
                this.unsubscribeVisits();
                this.unsubscribeVisits = null;
            }
        },

        queueValue(value) {
            const number = parseInt(
                String(value ?? '').replace(/\D/g, ''),
                10
            );

            return Number.isNaN(number) ? 999999 : number;
        },

        formatQueueNumber(number) {
            if (number === null || number === undefined || number === '') {
                return '—';
            }

            const value = String(number);
            return value.toUpperCase().startsWith('Q') ? value : `Q${value}`;
        },

        formatMedicineStatus(status) {
            const value = String(status || '').trim().toLowerCase();

            if (value === 'preparing') {
                return 'Preparing';
            }

            if (value === 'ready' || value === 'ready for collection') {
                return 'Ready';
            }

            if (value === 'collected') {
                return 'Collected';
            }

            return status || 'Not available';
        },

        medicineStatusClass(status) {
            const value = String(status || '').trim().toLowerCase();

            if (value === 'preparing') {
                return 'status-preparing';
            }

            if (value === 'ready' || value === 'ready for collection') {
                return 'status-ready';
            }

            if (value === 'collected') {
                return 'status-collected';
            }

            return 'status-other';
        },

        visitStatusClass(status) {
            const value = String(status || '').trim().toLowerCase();

            if (value === 'awaiting medicine') {
                return 'status-awaiting';
            }

            if (value === 'completed') {
                return 'status-completed';
            }

            return 'status-other';
        },

        isPreparing(status) {
            return String(status || '').trim().toLowerCase() === 'preparing';
        },

        isReady(status) {
            const value = String(status || '').trim().toLowerCase();

            return value === 'ready' || value === 'ready for collection';
        },

        isCollected(status) {
            return String(status || '').trim().toLowerCase() === 'collected';
        },

        formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        }
    }
};
</script>

<style scoped>
.medicine-collection {
    padding: 28px 32px;
    color: #172b46;
    background: #f7f9fb;
    min-height: 100%;
}

.page-header {
    margin-bottom: 24px;
}

.page-header h1 {
    font-size: 26px;
    margin: 0 0 6px;
}

.page-header p {
    color: #73829a;
    font-size: 14px;
    margin: 0;
}

.medicine-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.medicine-card {
    background: white;
    border: 1px solid #e8edf2;
    border-radius: 10px;
    padding: 18px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
}

.medicine-info {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
}

.medicine-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 46px;
    height: 46px;
    border-radius: 10px;
    background: #f7f0ff;
    font-size: 22px;
}

.patient-details {
    min-width: 0;
}

.patient-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 7px;
}

.patient-heading h2 {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    overflow-wrap: anywhere;
}

.queue-number {
    font-size: 12px;
    color: #75839a;
}

.status-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-bottom: 7px;
}

.status-badge {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
}

.status-preparing {
    background: #fff0d7;
    color: #9a6900;
}

.status-ready {
    background: #e5edff;
    color: #3a62a0;
}

.status-collected,
.status-completed {
    background: #dff6f2;
    color: #117c72;
}

.status-awaiting {
    background: #f2e5ff;
    color: #8845c0;
}

.status-other {
    background: #edf0f4;
    color: #637083;
}

.prescription {
    color: #73829a;
    font-size: 12px;
    margin: 0;
    overflow-wrap: anywhere;
}

.medicine-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
}

.medicine-actions button {
    padding: 9px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: not-allowed;
    opacity: 0.6;
}

.button-ready {
    background: white;
    color: #3a62a0;
    border: 1px solid #c7d9ff;
}

.button-collected {
    background: #178b87;
    color: white;
    border: 1px solid #178b87;
}

.collected-label {
    font-size: 13px;
    font-weight: 600;
    color: #117c72;
}

.page-message {
    background: white;
    border: 1px solid #e8edf2;
    border-radius: 10px;
    color: #73829a;
    text-align: center;
    font-size: 14px;
    padding: 40px 20px;
}

.error-message {
    color: #b42318;
}

@media (max-width: 600px) {
    .medicine-collection {
        padding: 20px 16px;
    }

    .page-header h1 {
        font-size: 22px;
    }

    .medicine-card {
        flex-direction: column;
        align-items: stretch;
    }

    .medicine-actions {
        justify-content: flex-end;
    }
}
</style>
