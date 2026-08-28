<template>
  <el-container style="height:100vh">
    <NavSidebar />
    <el-container>
      <el-header style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:18px;font-weight:bold">考題</span>
        <el-button type="primary" @click="openAdd">+ 新增考題</el-button>
      </el-header>
      <el-main>
        <el-select v-model="filterCat" placeholder="全部類型" clearable style="margin-bottom:16px;width:160px">
          <el-option label="TOEIC" value="TOEIC" />
          <el-option label="GEPT" value="GEPT" />
          <el-option label="TOEFL" value="TOEFL" />
        </el-select>

        <el-table :data="store.quizzes" v-loading="store.loading" stripe>
          <el-table-column prop="question" label="題目" />
          <el-table-column prop="category" label="類型" width="100" />
          <el-table-column prop="answer" label="答案" width="80" />
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button size="small" @click="openEdit(row)">編輯</el-button>
              <el-button size="small" type="danger" @click="remove(row.id)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-main>
    </el-container>
  </el-container>

  <el-dialog v-model="showForm" :title="editId ? '編輯考題' : '新增考題'" width="540px">
    <el-form :model="form" label-width="80px">
      <el-form-item label="題目">
        <el-input v-model="form.question" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item v-for="(_, i) in form.options" :key="i" :label="`選項 ${String.fromCharCode(65+i)}`">
        <el-input v-model="form.options[i]" />
      </el-form-item>
      <el-form-item label="正確答案">
        <el-select v-model="form.answer" style="width:80px">
          <el-option v-for="(_, i) in form.options" :key="i"
            :label="String.fromCharCode(65+i)" :value="String.fromCharCode(65+i)" />
        </el-select>
      </el-form-item>
      <el-form-item label="解析">
        <el-input v-model="form.explanation" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="類型">
        <el-select v-model="form.category" clearable>
          <el-option label="TOEIC" value="TOEIC" />
          <el-option label="GEPT" value="GEPT" />
          <el-option label="TOEFL" value="TOEFL" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showForm = false">取消</el-button>
      <el-button type="primary" @click="save">儲存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import NavSidebar from '../components/NavSidebar.vue'
import { useQuizzesStore } from '../stores/quizzes.js'

const store = useQuizzesStore()
const filterCat = ref('')
const showForm = ref(false)
const editId = ref(null)
const form = ref({ question: '', options: ['', '', '', ''], answer: 'A', explanation: '', category: '' })

watch(filterCat, (v) => store.fetchAll(v ? { category: v } : {}))

function openAdd() {
  editId.value = null
  form.value = { question: '', options: ['', '', '', ''], answer: 'A', explanation: '', category: '' }
  showForm.value = true
}
function openEdit(row) {
  editId.value = row.id
  form.value = { question: row.question, options: [...row.options], answer: row.answer, explanation: row.explanation, category: row.category }
  showForm.value = true
}

async function save() {
  if (!form.value.question) return ElMessage.warning('請填寫題目')
  try {
    if (editId.value) await store.editQuiz(editId.value, form.value)
    else await store.addQuiz(form.value)
    showForm.value = false
    ElMessage.success('已儲存')
  } catch (e) {
    ElMessage.error('儲存失敗：' + e.message)
  }
}

async function remove(id) {
  await ElMessageBox.confirm('確定刪除？', '刪除', { type: 'warning' })
  await store.removeQuiz(id)
  ElMessage.success('已刪除')
}

onMounted(() => store.fetchAll())
</script>
