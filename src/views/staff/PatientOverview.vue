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
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
                                <span v-if="visit.medicineStatus" class="status-badge medicine-badge"
                                    :class="'medicine-' + String(visit.medicineStatus).trim().toLowerCase().replaceAll(' ', '-')">
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
    background: var(--color-background);
    color: var(--color-text);
    margin: 0 auto;
    max-width: var(--width-content, 1150px);
    min-height: 100%;
    padding: 32px 24px 64px;
}

.page-header {
    margin-bottom: 24px;
}

.page-header h1 {
    color: var(--color-text);
    font-size: var(--font-size-page-title, 28px);
    margin: 0 0 6px;
}

.page-header p {
    color: var(--color-text-muted);
    font-size: 14px;
    margin: 0;
}

.overview-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card, 8px);
    padding: 20px;
}

.date-label {
    color: var(--color-text-muted);
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 16px;
}

.search-box {
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-control, 6px);
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    min-height: 44px;
    padding: 10px 12px;
}

.search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
    height: 18px;
    width: 18px;
}

.search-box input {
    background: transparent;
    border: none;
    color: var(--color-text);
    font-size: 14px;
    outline: none;
    width: 100%;
}

.search-box input::placeholder {
    color: var(--color-text-muted);
}

.search-box:focus-within {
    border-color: var(--color-primary-dark);
    box-shadow: 0 0 0 2px var(--color-primary-soft);
}

/* 5B filters */
.filters-row {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: 16px;
}

.filter-select {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-control, 6px);
    color: var(--color-text);
    font-size: 13px;
    min-height: 42px;
    min-width: 0;
    padding: 10px 12px;
    width: 100%;
}

.filter-select:focus-visible {
    border-color: var(--color-primary-dark);
}

.clear-filters-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
}

.clear-filters-button {
    background: transparent;
    border: 0;
    color: var(--color-primary-dark);
    font-size: 13px;
    padding: 3px 0;
}

.clear-filters-button:hover {
    background: transparent;
    text-decoration: underline;
}

.table-container {
    overflow-x: auto;
}

.patient-table {
    border-collapse: collapse;
    min-width: 800px;
    text-align: left;
    width: 100%;
}

.patient-table th {
    background: #f1f5f6;
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 600;
    padding: 13px 12px;
    text-align: left;
}

.patient-table td {
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text);
    font-size: 13px;
    line-height: 1.5;
    padding: 14px 12px;
}

.patient-table tbody tr:hover {
    background: #f8fbfb;
}

.patient-table tbody tr:last-child td {
    border-bottom: none;
}

.queue-number {
    font-variant-numeric: tabular-nums;
}

.queue-number,
.patient-name {
    font-weight: 600;
}

.status-badge {
    border-radius: var(--radius-badge, 4px);
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
    padding: 5px 9px;
    white-space: nowrap;
}

.status-waiting,
.status-other {
    background: #eef2f4;
    color: var(--color-text-muted);
}

.status-consultation {
    background: var(--color-info-soft);
    color: var(--color-info);
}

.status-medicine {
    background: var(--color-warning-soft);
    color: var(--color-warning);
}

.status-completed {
    background: var(--color-success-soft);
    color: var(--color-success);
}

.status-absent {
    background: #eef2f4;
    color: var(--color-text-muted);
}

.medicine-badge {
    background: #eef2f4;
    color: var(--color-text-muted);
}

.medicine-preparing {
    background: var(--color-warning-soft);
    color: var(--color-warning);
}

.medicine-ready,
.medicine-ready-for-collection {
    background: var(--color-info-soft);
    color: var(--color-info);
}

.medicine-collected {
    background: var(--color-success-soft);
    color: var(--color-success);
}

.table-message {
    color: var(--color-text-muted);
    font-size: 14px;
    padding: 40px 12px;
    text-align: center;
}

.error-message {
    color: var(--color-danger);
}

@media (max-width: 900px) {
    .filters-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 600px) {
    .patient-overview {
        padding: 24px 16px 48px;
    }

    .overview-card {
        padding: 14px;
    }

    .filters-row {
        grid-template-columns: 1fr;
    }
}
</style>
