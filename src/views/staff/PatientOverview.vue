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

            <!-- 5A patient name search -->
            <div class="search-box">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7"></circle>
                    <path d="M20 20l-4-4"></path>
                </svg>
                <input type="search" v-model="searchQuery" placeholder="Search patient name..."
                    aria-label="Search patient name">
            </div>

            <!-- 5B doctor, visit type, status and medicine filters -->
            <div class="filters-row">
                <select v-model="doctorFilter" class="filter-select" aria-label="Filter by doctor">
                    <option value="">All Doctors</option>
                    <option v-for="doctor in doctorOptions" :key="doctor" :value="doctor">
                        {{ doctor }}
                    </option>
                    <option v-if="hasUnassignedDoctor" value="__unassigned__">Unassigned</option>
                </select>

                <select v-model="typeFilter" class="filter-select" aria-label="Filter by visit type">
                    <option value="">All Types</option>
                    <option value="Appointment">Appointment</option>
                    <option value="Walk-in">Walk-in</option>
                </select>

                <select v-model="statusFilter" class="filter-select" aria-label="Filter by visit status">
                    <option value="">All Statuses</option>
                    <option v-for="status in statusOptions" :key="status" :value="status">
                        {{ status }}
                    </option>
                </select>

                <select v-model="medicineFilter" class="filter-select" aria-label="Filter by medicine status">
                    <option value="">All Medicine</option>
                    <option v-for="status in medicineOptions" :key="status" :value="status">
                        {{ status }}
                    </option>
                    <option v-if="hasNoMedicine" value="__none__">No Medicine</option>
                </select>
            </div>

            <div v-if="hasActiveFilters" class="clear-filters-row">
                <button type="button" class="clear-filters-button" @click="clearFilters">
                    Clear Filters
                </button>
            </div>

            <p v-if="loading" class="table-message">
                Loading patients...
            </p>

            <p v-else-if="errorMessage" class="table-message error-message">
                {{ errorMessage }}
            </p>

            <p v-else-if="visits.length === 0" class="table-message">
                No patient visits found for today
            </p>

            <p v-else-if="filteredVisits.length === 0" class="table-message">
                No matching patients found
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
                        <tr v-for="visit in filteredVisits" :key="visit.id">
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
            searchQuery: '',
            doctorFilter: '',
            typeFilter: '',
            statusFilter: '',
            medicineFilter: '',
            today: '',
            loading: true,
            errorMessage: '',
            unsubscribeAuth: null,
            unsubscribeVisits: null,
            loadVersion: 0
        };
    },

    computed: {
        // 5A filter patients by name
        // 5B combine the search with doctor, type, status and medicine filters
        filteredVisits() {
            const query = this.searchQuery.trim().toLowerCase();

            return this.visits.filter((visit) => {
                const matchesName = visit.patientName.toLowerCase().includes(query);

                const matchesDoctor = !this.doctorFilter ||
                    (this.doctorFilter === '__unassigned__'
                        ? visit.doctorName === '—'
                        : visit.doctorName === this.doctorFilter);

                const matchesType = !this.typeFilter ||
                    this.formatVisitType(visit.visitType) === this.typeFilter;

                const matchesStatus = !this.statusFilter ||
                    visit.visitStatus === this.statusFilter;

                const matchesMedicine = !this.medicineFilter ||
                    (this.medicineFilter === '__none__'
                        ? !visit.medicineStatus
                        : visit.medicineStatus === this.medicineFilter);

                return matchesName && matchesDoctor && matchesType &&
                    matchesStatus && matchesMedicine;
            });
        },

        // 5B populate filter options from current visits
        doctorOptions() {
            return [...new Set(this.visits
                .map((visit) => visit.doctorName)
                .filter((name) => name && name !== '—'))]
                .sort((a, b) => a.localeCompare(b));
        },

        hasUnassignedDoctor() {
            return this.visits.some((visit) => visit.doctorName === '—');
        },

        statusOptions() {
            return [...new Set(this.visits.map((visit) => visit.visitStatus))]
                .sort((a, b) => a.localeCompare(b));
        },

        medicineOptions() {
            return [...new Set(this.visits
                .map((visit) => visit.medicineStatus)
                .filter(Boolean))]
                .sort((a, b) => a.localeCompare(b));
        },

        hasNoMedicine() {
            return this.visits.some((visit) => !visit.medicineStatus);
        },

        hasActiveFilters() {
            return !!(this.searchQuery || this.doctorFilter || this.typeFilter ||
                this.statusFilter || this.medicineFilter);
        }
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
        // 5B clear all search and filter selections
        clearFilters() {
            this.searchQuery = '';
            this.doctorFilter = '';
            this.typeFilter = '';
            this.statusFilter = '';
            this.medicineFilter = '';
        },

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

.search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #e8edf2;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 16px;
}

.search-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #75839a;
}

.search-box input {
    width: 100%;
    border: none;
    outline: none;
    color: #172b46;
    background: transparent;
    font-size: 13px;
}

.search-box input::placeholder {
    color: #75839a;
}

.search-box:focus-within {
    border-color: #178b87;
}

/* 5B filters */
.filters-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 16px;
}

.filter-select {
    width: 100%;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid #e8edf2;
    border-radius: 6px;
    background: white;
    color: #172b46;
    font-size: 13px;
}

.filter-select:focus {
    outline: 2px solid #178b87;
    outline-offset: 1px;
}

.clear-filters-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
}

.clear-filters-button {
    border: none;
    background: none;
    color: #178b87;
    cursor: pointer;
    font-size: 13px;
    padding: 2px;
}

.clear-filters-button:hover {
    text-decoration: underline;
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

@media (max-width: 900px) {
    .filters-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 600px) {
    .filters-row {
        grid-template-columns: 1fr;
    }

    .patient-overview {
        padding: 20px 16px;
    }

    .page-header h1 {
        font-size: 22px;
    }
}
</style>
