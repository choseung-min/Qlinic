<template>
    <section class="patient-overview">
        <div class="page-header">
            <h1>Patient Overview</h1>
            <p>Search and filter all clinic patients</p>
        </div>

        <div class="overview-card">
            <p class="date-label">
                Today's visits · {{ formatDisplayDate(today) }}
            </p>

            <p v-if="loading" class="table-message">
                Loading patients...
            </p>

            <p v-else-if="errorMessage" class="table-message error-message">
                {{ errorMessage }}
            </p>

            <p v-else-if="visits.length === 0" class="table-message">
                No patient visits found for today
            </p>

            <div v-else class="table-container">
                <table class="patient-table">
                    <thead>
                        <tr>
                            <th>QUEUE #</th>
                            <th>PATIENT</th>
                            <th>TYPE</th>
                            <th>DOCTOR</th>
                            <th>STATUS</th>
                            <th>MEDICINE</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="visit in visits" :key="visit.id">
                            <td class="queue-number">
                                {{ visit.queueNumber || '—' }}
                            </td>

                            <td class="patient-name">
                                {{ visit.patientName }}
                            </td>

                            <td>
                                {{ formatVisitType(visit.visitType) }}
                            </td>

                            <td>
                                {{ visit.doctorName }}
                            </td>

                            <td>
                                <span class="status-badge" :class="statusClass(visit.visitStatus)">
                                    {{ visit.visitStatus }}
                                </span>
                            </td>

                            <td>
                                <span v-if="visit.medicineStatus" class="status-badge medicine-badge">
                                    {{ visit.medicineStatus }}
                                </span>
                                <span v-else>—</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>
</template>

<script>
import { auth, db } from '@/services/firebase.js';

export default {
    name: 'PatientOverview',

    data() {
        return {
            visits: [],
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
            this.visits = [];
            this.errorMessage = '';

            if (user) {
                this.listenForVisits();
            } else {
                this.loading = false;
                this.errorMessage = 'Please log in to view patients';
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
        // 9A retrieve and display today's patient visits
        listenForVisits() {
            this.loading = true;

            this.unsubscribeVisits = db.collection('visits')
                .where('visitDate', '==', this.today)
                .onSnapshot(async (snapshot) => {
                    const version = ++this.loadVersion;

                    try {
                        const rows = [];
                        const patientNames = {};
                        const doctorNames = {};

                        for (const document of snapshot.docs) {
                            const visit = document.data();

                            let patientName = visit.patientName || '';
                            let doctorName = visit.doctorName || '—';

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

                            // retrieve assigned doctor name
                            if (!visit.doctorName && visit.doctorId) {
                                if (doctorNames[visit.doctorId]) {
                                    doctorName = doctorNames[visit.doctorId];
                                } else {
                                    try {
                                        const doctorDoc = await db.collection('doctors')
                                            .doc(visit.doctorId)
                                            .get();

                                        if (doctorDoc.exists) {
                                            doctorName = doctorDoc.data().name || '—';
                                        }
                                    } catch (error) {
                                        console.warn(
                                            'Unable to retrieve doctor name:',
                                            error
                                        );
                                    }

                                    doctorNames[visit.doctorId] = doctorName;
                                }
                            }

                            rows.push({
                                id: document.id,
                                queueNumber: visit.queueNumber || '',
                                patientName: patientName || 'Patient name unavailable',
                                visitType: visit.visitType || '',
                                doctorName: doctorName,
                                visitStatus: visit.visitStatus || 'Unknown',
                                medicineStatus: visit.medicineStatus ||
                                    visit.medicineCollectionStatus || ''
                            });
                        }

                        // display patients according to queue number
                        rows.sort((a, b) => {
                            return this.queueValue(a.queueNumber) -
                                this.queueValue(b.queueNumber);
                        });

                        if (version === this.loadVersion && auth.currentUser) {
                            this.visits = rows;
                            this.errorMessage = '';
                            this.loading = false;
                        }

                    } catch (error) {
                        console.error('Error loading patient overview:', error);

                        if (version === this.loadVersion) {
                            this.errorMessage = 'Unable to load patient overview';
                            this.loading = false;
                        }
                    }
                }, (error) => {
                    console.error('Error listening for visits:', error);

                    this.errorMessage = 'Unable to load patient overview';
                    this.loading = false;
                });
        },

        stopListening() {
            this.loadVersion++;

            if (this.unsubscribeVisits) {
                this.unsubscribeVisits();
                this.unsubscribeVisits = null;
            }
        },

        queueValue(value) {
            return parseInt(
                String(value).replace(/\D/g, ''),
                10
            ) || 0;
        },

        formatVisitType(type) {
            if (!type) {
                return '—';
            }

            return type.toLowerCase().includes('walk')
                ? 'Walk-in'
                : 'Appointment';
        },

        statusClass(status) {
            const value = status.toLowerCase();

            if (value === 'waiting') {
                return 'status-waiting';
            }

            if (value === 'in consultation') {
                return 'status-consultation';
            }

            if (value === 'awaiting medicine') {
                return 'status-medicine';
            }

            if (value === 'completed') {
                return 'status-completed';
            }

            if (value === 'absent' || value === 'cancelled') {
                return 'status-absent';
            }

            return 'status-other';
        },

        formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        },

        formatDisplayDate(date) {
            if (!date) {
                return '';
            }

            return new Date(date + 'T00:00:00')
                .toLocaleDateString('en-SG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
        }
    }
};
</script>

<style scoped>
.patient-overview {
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

.overview-card {
    background: white;
    border: 1px solid #e8edf2;
    border-radius: 12px;
    padding: 16px;
}

.date-label {
    color: #73829a;
    font-size: 13px;
    margin: 0 0 16px;
}

.table-container {
    overflow-x: auto;
}

.patient-table {
    border-collapse: collapse;
    width: 100%;
    min-width: 700px;
    text-align: left;
}

.patient-table th {
    background: #f7f9fb;
    color: #75839a;
    font-size: 11px;
    padding: 14px 12px;
}

.patient-table td {
    border-bottom: 1px solid #edf0f4;
    font-size: 13px;
    padding: 14px 12px;
}

.patient-table tbody tr:last-child td {
    border-bottom: none;
}

.queue-number,
.patient-name {
    font-weight: 600;
}

.status-badge {
    border-radius: 5px;
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 9px;
    white-space: nowrap;
}

.status-waiting,
.status-completed,
.medicine-badge {
    background: #dff6f2;
    color: #117c72;
}

.status-consultation {
    background: #e5edff;
    color: #3a62a0;
}

.status-medicine {
    background: #fff4d8;
    color: #906400;
}

.status-absent,
.status-other {
    background: #edf0f4;
    color: #637083;
}

.table-message {
    padding: 32px 12px;
    color: #73829a;
    font-size: 14px;
    text-align: center;
}

.error-message {
    color: #b42318;
}

@media (max-width: 600px) {
    .patient-overview {
        padding: 20px 16px;
    }

    .page-header h1 {
        font-size: 22px;
    }
}
</style>
