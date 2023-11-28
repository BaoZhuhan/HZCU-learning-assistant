import { useEffect, useState } from 'react'
import { Form, Button, Card, App, Row, Col, Select, Table, Progress, Tooltip } from 'antd';
import { invoke } from '@tauri-apps/api'
import { ReloadOutlined, DownloadOutlined, CloseCircleOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { listen } from '@tauri-apps/api/event'
import { dialog, shell } from '@tauri-apps/api';

export default function Home({ setIsLogin }) {
  const { message, modal, notification } = App.useApp()
  const [form] = Form.useForm()

  const [semesterList, setSemesterList] = useState([])
  const [loadingSemesterList, setLoadingSemesterList] = useState(false)
  const [academicYearList, setAcademicYearList] = useState([])
  const [loadingAcademicYearList, setLoadingAcademicYearList] = useState(false)
  const [courseList, setCourseList] = useState([])
  const [loadingCourseList, setLoadingCourseList] = useState(false)
  const [selectedCourses, setSelectedCourses] = useState([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(null)
  const [selectedSemester, setSelectedSemester] = useState(null)
  const [selectedCourseKeys, setSelectedCourseKeys] = useState([])
  const [progress, setProgress] = useState({
    progress: 0,
    status: ''
  })
  const [loadingUploadList, setLoadingUploadList] = useState(false)
  const [uploadList, setUploadList] = useState([])
  const [selectedUploadKeys, setSelectedUploadKeys] = useState([])
  const [downloading, setDownloading] = useState(false)
  const [updatingPath, setUpdatingPath] = useState(false)

  const courseColumns = [
    {
      title: '课程名称',
      dataIndex: 'name',
    },
  ]

  useEffect(() => {
    invoke('check_login').then((res) => {
      if (!res) {
        setIsLogin(false)
      }
    }).catch((err) => {
      setIsLogin(false)
    })

    setLoadingSemesterList(true)
    invoke('get_semester_list').then((res) => {
      // console.log(res)
      res.sort((a, b) => {
        return b.sort - a.sort
      })
      setSemesterList(res)
    }).catch((err) => {
      notification.error({
        message: '获取学期列表失败',
        description: err
      })
    }).finally(() => {
      setLoadingSemesterList(false)
    })

    setLoadingAcademicYearList(true)
    invoke('get_academic_year_list').then((res) => {
      // console.log(res)
      res.sort((a, b) => {
        return b.sort - a.sort
      })
      setAcademicYearList(res)
    }).catch((err) => {
      notification.error({
        message: '获取学年列表失败',
        description: err
      })
    }).finally(() => {
      setLoadingAcademicYearList(false)
    })

    setLoadingCourseList(true)
    invoke('get_courses').then((res) => {
      // console.log(res)
      setCourseList(res)
      setSelectedCourses(res.map((item) => {
        return {
          key: item.id,
          name: item.name
        }
      }))
    }).catch((err) => {
      notification.error({
        message: '获取课程列表失败',
        description: err
      })
    }).finally(() => {
      setLoadingCourseList(false)
    })

    const unlisten = listen('download-progress', (progress) => {
      // console.log(progress)
      setProgress(progress.payload)
    })

    return () => {
      unlisten.then((fn) => fn())
    }

  }, [])

  const onFinish = (values) => {
    let uploads = uploadList.filter((item) => selectedUploadKeys.includes(item.reference_id))
    if (uploads.length === 0) {
      notification.error({
        message: '请选择课件',
      })
      return
    }
    setDownloading(true)
    invoke('download_uploads', { uploads }).then((res) => {
      // console.log(res)
      if (res.length === selectedUploadKeys.length) {
        notification.success({
          message: '下载完成',
        })
      }
      let haveDownloaded = res.map((item) => item.reference_id)
      setSelectedUploadKeys(selectedUploadKeys.filter((item) => !haveDownloaded.includes(item)))
      setUploadList(uploadList.filter((item) => !haveDownloaded.includes(item.reference_id)))
    }).catch((err) => {
      notification.error({
        message: '下载失败',
        description: err
      })
    }).finally(() => {
      setDownloading(false)
    })
  }

  const updateCourseList = (academicYearID, semesterID) => {
    let semester = semesterList.find((item) => item.id === semesterID)
    setSelectedCourses(courseList.filter((item) => {
      return (semesterID && (item.semester_id === semester.id || (item.semester_id === 0 && item.academic_year_id === semester.academic_year_id))) ||
        (!semesterID && academicYearID && item.academic_year_id === academicYearID) ||
        (!semesterID && !academicYearID)
    }).map((item) => {
      return {
        key: item.id,
        name: item.name
      }
    }))
  }

  const onAcademicYearChange = (value) => {
    // console.log(`selected academic year ${value}`);
    setSelectedAcademicYear(value)
    setSelectedSemester(null)
    updateCourseList(value)
    setSelectedCourseKeys([])
  };

  const onSemesterChange = (value) => {
    // console.log(`selected semester ${value}`);
    setSelectedSemester(value)
    updateCourseList(selectedAcademicYear, value)
    setSelectedCourseKeys([])
  };

  const filterOption = (input, option) =>
    (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

  const onSelectChange = (newSelectedRowKeys) => {
    // console.log('selectedRowKeys changed: ', newSelectedRowKeys);
    setSelectedCourseKeys(newSelectedRowKeys)
  };

  const onUploadSelectChange = (newSelectedRowKeys) => {
    // console.log('selectedRowKeys changed: ', newSelectedRowKeys);
    setSelectedUploadKeys(newSelectedRowKeys)
  }

  const updateUploadList = () => {
    let courses = courseList.filter((item) => selectedCourseKeys.includes(item.id))
    // console.log(courses)
    if (courses.length === 0) {
      notification.error({
        message: '请选择课程',
      })
      return
    }
    setLoadingUploadList(true)
    invoke('get_uploads_list', { courses }).then((res) => {
      // console.log(res)
      setUploadList(res)
      setSelectedUploadKeys(res.map((item) => item.reference_id))
    }).catch((err) => {
      notification.error({
        message: '获取课件列表失败',
        description: err
      })
    }).finally(() => {
      setLoadingUploadList(false)
    })
  }

  const cancelDownload = () => {
    invoke('cancel_download').then((res) => {
      // console.log(res)
      setDownloading(false)
    }).catch((err) => {
      notification.error({
        message: '取消下载失败',
        description: err
      })
    })
  }

  const updatePath = () => {
    dialog.open({
      directory: true,
      multiple: false,
      message: '选择下载路径'
    }).then((res) => {
      if (res && res.length !== 0) {
        setUpdatingPath(true)
        invoke('update_path', { path: res, uploads: uploadList }).then((res) => {
          console.log(res)
          notification.success({
            message: '下载路径修改成功',
          })
          setUploadList(res)
        }).catch((err) => {
          notification.error({
            message: '下载路径修改失败',
            description: err
          })
        }).finally(() => {
          setUpdatingPath(false)
        })
      }
    }).catch((err) => {
      notification.error({
        message: '下载路径修改失败',
        description: err
      })
    })
  }

  const openDownloadPath = () => {
    invoke('get_save_path').then((res) => {
    }).catch((err) => {
      notification.error({
        message: '打开下载路径失败',
        description: err
      })
    })
  }

  const uploadColumns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
    },
    {
      title: '大小',
      dataIndex: 'size',
      responsive: ['md'],
      render: (size) => {
        return size < 1024 ? `${size} B` :
          size < 1024 * 1024 ? `${(size / 1024).toFixed(2)} KB` :
            size < 1024 * 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` :
              `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
      }
    },
    {
      title: () => (
        <div>
          下载路径
          <Tooltip title='修改下载路径'>
            <Button
              type='text'
              size='small'
              icon={<EditOutlined />}
              onClick={updatePath}
              style={{
                float: 'right',
              }}
            />
          </Tooltip>
          <Tooltip title='打开下载路径'>
            <Button
              type='text'
              size='small'
              icon={<ExportOutlined />}
              onClick={openDownloadPath}
              style={{
                float: 'right',
              }}
            />
          </Tooltip>
        </div>
      ),
      dataIndex: 'path',
    },
  ]

  return (
    <div style={{
      margin: 20
    }}>
      <h1>Home</h1>
      <Button
        style={{
          position: 'absolute',
          right: 30,
          top: 30
        }}
        onClick={() => {
          invoke('logout').then((res) => {
            setIsLogin(false)
          }).catch((err) => {
            notification.error({
              message: '退出登录失败',
              description: err
            })
          })
        }}
        disabled={downloading}
      >退出登录</Button>
      <Card
        style={{
          height: 80
        }}
      >
        <Form
          layout='horizontal'
          form={form}
          onFinish={onFinish}
        >
          <Row
            gutter={24}
            justify="space-between"
            align="middle"
          >
            <Col xs={9} md={10}>
              <Form.Item label='学年' name='academicYear'>
                <Select
                  allowClear
                  showSearch
                  width='100%'
                  optionFilterProp="children"
                  value={selectedAcademicYear}
                  onChange={onAcademicYearChange}
                  filterOption={filterOption}
                  options={academicYearList.map((item) => {
                    return {
                      label: item.name,
                      value: item.id
                    }
                  })}
                  loading={loadingAcademicYearList}
                />
              </Form.Item>
            </Col>
            <Col xs={9} md={10}>
              <Form.Item label='学期' name='semester'>
                <Select
                  allowClear
                  showSearch
                  width='100%'
                  optionFilterProp="children"
                  value={selectedSemester}
                  onChange={onSemesterChange}
                  filterOption={filterOption}
                  options={semesterList.map((item) => {
                    if (selectedAcademicYear && selectedAcademicYear !== item.academic_year_id) {
                      return null
                    } else {
                      return {
                        label: item.name,
                        value: item.id
                      }
                    }
                  }).filter((item) => item !== null)}
                  loading={loadingSemesterList}
                />
              </Form.Item>
            </Col>
            <Col xs={6} md={4}>
              <Form.Item>
                <Button
                  type='primary'
                  icon={downloading ? <CloseCircleOutlined /> : <DownloadOutlined />}
                  onClick={downloading ? cancelDownload : onFinish}
                >{
                    downloading ? '取消下载' : '下载课件'
                  }</Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
      <Row
        style={{
          marginTop: 20
        }}
        gutter={20}
      >
        <Col xs={10} md={8}>
          <Table
            rowSelection={{
              selectedRowKeys: selectedCourseKeys,
              onChange: onSelectChange,
            }}
            columns={courseColumns}
            dataSource={selectedCourses}
            loading={loadingCourseList}
            pagination={false}
            scroll={{ y: 'calc(100vh - 340px)' }}
            size='small'
            bordered
            title={() => `课程列表：已选择 ${selectedCourseKeys.length} 门课程`}
          />
        </Col>
        <Col xs={14} md={16}>
          <Table
            rowSelection={{
              selectedRowKeys: selectedUploadKeys,
              onChange: onUploadSelectChange,
            }}
            rowKey='reference_id'
            columns={uploadColumns}
            dataSource={uploadList}
            loading={loadingUploadList || downloading || updatingPath}
            pagination={false}
            scroll={{ y: 'calc(100vh - 350px)' }}
            size='small'
            bordered
            title={() => {
              return (
                <>
                  {uploadList && uploadList.length !== 0 && `课件列表：已选择 ${selectedUploadKeys.length} 个文件`}
                  {(!uploadList || uploadList.length === 0) && '课件列表为空  点击右侧刷新👉'}
                  <Tooltip title='刷新课件列表'>
                    <Button
                      type='text'
                      size='small'
                      icon={<ReloadOutlined />}
                      onClick={updateUploadList}
                      style={{
                        float: 'right',
                      }}
                      loading={loadingUploadList}
                      disabled={downloading}
                    />
                  </Tooltip>
                </>
              )
            }}
          />
        </Col>
      </Row>
      <p style={{
        position: 'absolute',
        left: 30,
        bottom: 30
      }}>{progress.status === '' ? '下载进度' : progress.status}</p>
      <Progress percent={Math.round(progress.progress * 100)} style={{
        position: 'absolute',
        bottom: 10,
        left: 30,
        width: 'calc(100% - 60px)'
      }} />
    </div>
  )
}