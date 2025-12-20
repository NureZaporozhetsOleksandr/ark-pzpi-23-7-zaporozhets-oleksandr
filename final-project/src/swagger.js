const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API системи моніторингу праці співробітників',
    version: '1.0.0',
    description: 'Документація REST API для лабораторної роботи №3'
  },
  servers: [
  { url: '/' }
],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      UserRegistrationDto: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          login: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' }
        },
        required: ['fullName', 'login', 'email', 'password']
      },
      LoginDto: {
        type: 'object',
        properties: {
          login: { type: 'string' },
          password: { type: 'string', format: 'password' }
        },
        required: ['login', 'password']
      },
      UserDto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          fullName: { type: 'string' },
          login: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      },
      TimeEntryDto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          entryType: { type: 'string', example: 'StartWork' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time', nullable: true },
          comment: { type: 'string', nullable: true }
        }
      },
      TimeEntryUpdateDto: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          comment: { type: 'string' }
        },
        description: 'Поля, які можна змінювати під час редагування відмітки часу'
      },
      AbsenceCreateDto: {
        type: 'object',
        properties: {
          type: { type: 'string', example: 'Vacation' },
          dateStart: { type: 'string', format: 'date' },
          dateEnd: { type: 'string', format: 'date' },
          comment: { type: 'string' }
        },
        required: ['type', 'dateStart', 'dateEnd']
      },
      AbsenceDto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          type: { type: 'string' },
          dateStart: { type: 'string', format: 'date' },
          dateEnd: { type: 'string', format: 'date' },
          comment: { type: 'string', nullable: true }
        }
      },
      WorkScheduleDto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer', nullable: true },
          startWork: { type: 'string', example: '09:00' },
          endWork: { type: 'string', example: '18:00' },
          breakMinutes: { type: 'integer' },
          workingDaysMask: { type: 'string', example: '1111100' }
        }
      },
      CreateScheduleDto: {
        type: 'object',
        properties: {
          userId: { type: 'integer', nullable: true },
          startWork: { type: 'string', example: '09:00' },
          endWork: { type: 'string', example: '18:00' },
          breakMinutes: { type: 'integer', example: 60 },
          workingDaysMask: { type: 'string', example: '1111100' }
        },
        required: ['startWork', 'endWork', 'breakMinutes', 'workingDaysMask']
      },

      // Денний запис звіту (нова бізнес-логіка)
      ReportDayDto: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          plannedMinutes: { type: 'integer' },
          workedMinutes: { type: 'integer' },
          overtimeMinutes: { type: 'integer' },
          undertimeMinutes: { type: 'integer' },
          isLate: { type: 'boolean' },
          lateMinutes: { type: 'integer' },
          hasAbsence: { type: 'boolean' }
        }
      },

      // Підсумки за період (нова бізнес-логіка)
      ReportTotalsDto: {
        type: 'object',
        properties: {
          totalPlannedMinutes: { type: 'integer' },
          totalWorkedMinutes: { type: 'integer' },
          totalOvertimeMinutes: { type: 'integer' },
          totalUndertimeMinutes: { type: 'integer' },
          totalLateMinutes: { type: 'integer' },
          lateDaysCount: { type: 'integer' },
          daysWithAbsence: { type: 'integer' }
        }
      },

      // Оновлений загальний DTO звіту
      ReportSummaryDto: {
        type: 'object',
        properties: {
          userId: { type: 'integer' },
          from: { type: 'string', format: 'date' },
          to: { type: 'string', format: 'date' },
          days: {
            type: 'array',
            items: { $ref: '#/components/schemas/ReportDayDto' }
          },
          totals: { $ref: '#/components/schemas/ReportTotalsDto' }
        }
      },

      AuditLogDto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer', nullable: true },
          action: { type: 'string' },
          entityName: { type: 'string' },
          entityId: { type: 'integer', nullable: true },
          timestamp: { type: 'string', format: 'date-time' },
          oldValue: { type: 'string', nullable: true },
          newValue: { type: 'string', nullable: true }
        }
      },

      // Нові DTO для адмін-функцій
      AdminUserWithStatsDto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          fullName: { type: 'string' },
          login: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          isActive: { type: 'boolean' },
          timeEntryCount: { type: 'integer' }
        }
      },
      SystemStatsDto: {
        type: 'object',
        properties: {
          activeUsers: { type: 'integer' },
          blockedUsers: { type: 'integer' },
          totalUsers: { type: 'integer' },
          totalTimeEntries: { type: 'integer' },
          totalAbsences: { type: 'integer' }
        }
      },
      ChangeUserRoleDto: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['Admin', 'Manager', 'Employee']
          }
        },
        required: ['role']
      }
    }
  },
  security: [
    { BearerAuth: [] }
  ],
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Реєстрація нового користувача',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserRegistrationDto' }
            }
          }
        },
        responses: {
          201: {
            description: 'Користувача створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserDto' }
              }
            }
          },
          400: { description: 'Помилка вхідних даних або логін уже існує' },
          500: { description: 'Помилка сервера або БД' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Авторизація користувача',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginDto' }
            }
          }
        },
        responses: {
          200: {
            description: 'Успішний вхід, повертається JWT-токен',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/UserDto' }
                  }
                }
              }
            }
          },
          400: { description: 'Не заповнено логін або пароль' },
          401: { description: 'Невірний логін або пароль' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Отримати інформацію про поточного користувача',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Дані поточного користувача',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserDto' }
              }
            }
          },
          401: { description: 'Неавторизований доступ' },
          404: { description: 'Користувача не знайдено' }
        }
      }
    },

    '/api/time-entries/start-work': {
      post: {
        tags: ['TimeEntries'],
        summary: 'Створити відмітку початку робочого дня',
        security: [{ BearerAuth: [] }],
        responses: {
          201: {
            description: 'Відмітку створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TimeEntryDto' }
              }
            }
          },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },
    '/api/time-entries/end-work': {
      post: {
        tags: ['TimeEntries'],
        summary: 'Створити відмітку завершення робочого дня',
        security: [{ BearerAuth: [] }],
        responses: {
          201: {
            description: 'Відмітку створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TimeEntryDto' }
              }
            }
          },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },
    '/api/time-entries/break-start': {
      post: {
        tags: ['TimeEntries'],
        summary: 'Початок перерви',
        security: [{ BearerAuth: [] }],
        responses: {
          201: {
            description: 'Відмітку створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TimeEntryDto' }
              }
            }
          },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },
    '/api/time-entries/break-end': {
      post: {
        tags: ['TimeEntries'],
        summary: 'Завершення перерви',
        security: [{ BearerAuth: [] }],
        responses: {
          201: {
            description: 'Відмітку створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TimeEntryDto' }
              }
            }
          },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },
    '/api/time-entries/my': {
      get: {
        tags: ['TimeEntries'],
        summary: 'Отримати відмітки поточного користувача за період',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'from',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            required: false
          },
          {
            name: 'to',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            required: false
          }
        ],
        responses: {
          200: {
            description: 'Список відміток часу',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/TimeEntryDto' }
                }
              }
            }
          },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },
    '/api/time-entries/{id}': {
      put: {
        tags: ['TimeEntries'],
        summary: 'Редагування відмітки робочого часу (корекція часу/коментаря)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TimeEntryUpdateDto' }
            }
          }
        },
        responses: {
          200: {
            description: 'Відмітку оновлено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TimeEntryDto' }
              }
            }
          },
          400: { description: 'Не передано жодного поля для оновлення' },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Заборонено редагувати чужий запис' },
          404: { description: 'Відмітку не знайдено' }
        }
      }
    },

    '/api/schedules/my': {
      get: {
        tags: ['Schedules'],
        summary: 'Отримати графік поточного користувача',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Поточний графік користувача або загальний графік',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkScheduleDto' }
              }
            }
          },
          401: { description: 'Неавторизований доступ' },
          404: { description: 'Графік не знайдено' }
        }
      }
    },
    '/api/schedules': {
      post: {
        tags: ['Schedules'],
        summary: 'Створити або призначити робочий графік (адмін)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateScheduleDto' }
            }
          }
        },
        responses: {
          201: {
            description: 'Графік створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkScheduleDto' }
              }
            }
          },
          400: { description: 'Помилка вхідних даних' },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Доступ заборонено (не адміністратор)' }
        }
      }
    },

    '/api/absences': {
      post: {
        tags: ['Absences'],
        summary: 'Створити запис відсутності',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AbsenceCreateDto' }
            }
          }
        },
        responses: {
          201: {
            description: 'Запис створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AbsenceDto' }
              }
            }
          },
          400: { description: 'Помилка вхідних даних' },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },
    '/api/absences/my': {
      get: {
        tags: ['Absences'],
        summary: 'Перегляд усіх відсутностей поточного користувача',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'from',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false
          },
          {
            name: 'to',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false
          }
        ],
        responses: {
          200: {
            description: 'Список відсутностей',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AbsenceDto' }
                }
              }
            }
          },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },

    // НОВА бізнес-логіка звітів
    '/api/reports/my/summary': {
      get: {
        tags: ['Reports'],
        summary: 'Формування зведеного звіту за робочим часом поточного користувача',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' }
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' }
          }
        ],
        responses: {
          200: {
            description: 'Зведений звіт для поточного користувача',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReportSummaryDto' }
              }
            }
          },
          400: { description: 'Не вказано from або to' },
          401: { description: 'Неавторизований доступ' }
        }
      }
    },

    '/api/audit': {
      get: {
        tags: ['Audit'],
        summary: 'Перегляд журналу змін у системі (адміністративний функціонал)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' }
          }
        ],
        responses: {
          200: {
            description: 'Список записів аудиту',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AuditLogDto' }
                }
              }
            }
          },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Доступ заборонено' }
        }
      }
    },

    // НОВІ АДМІН-ФУНКЦІЇ

    '/api/admin/system-stats': {
      get: {
        tags: ['Admin'],
        summary: 'Отримання загальної статистики системи',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Статистика системи',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SystemStatsDto' }
              }
            }
          },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Доступ заборонено (не адміністратор)' }
        }
      }
    },

    '/api/admin/users-with-stats': {
      get: {
        tags: ['Admin'],
        summary: 'Список користувачів із базовою статистикою за період',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' }
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' }
          }
        ],
        responses: {
          200: {
            description: 'Список користувачів та статистика по відмітках',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    from: { type: 'string', format: 'date' },
                    to: { type: 'string', format: 'date' },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AdminUserWithStatsDto' }
                    }
                  }
                }
              }
            }
          },
          400: { description: 'Не вказано from або to' },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Доступ заборонено (не адміністратор)' }
        }
      }
    },

    '/api/admin/users/{id}/block': {
      post: {
        tags: ['Admin'],
        summary: 'Блокування користувача',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: {
            description: 'Користувача заблоковано',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    userId: { type: 'integer' }
                  }
                }
              }
            }
          },
          400: { description: 'Користувач вже заблокований' },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Доступ заборонено' },
          404: { description: 'Користувача не знайдено' }
        }
      }
    },

    '/api/admin/users/{id}/unblock': {
      post: {
        tags: ['Admin'],
        summary: 'Розблокування користувача',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: {
            description: 'Користувача розблоковано',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    userId: { type: 'integer' }
                  }
                }
              }
            }
          },
          400: { description: 'Користувач вже активний' },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Доступ заборонено' },
          404: { description: 'Користувача не знайдено' }
        }
      }
    },

    '/api/admin/users/{id}/role': {
      patch: {
        tags: ['Admin'],
        summary: 'Зміна ролі користувача',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChangeUserRoleDto' }
            }
          }
        },
        responses: {
          200: {
            description: 'Роль користувача оновлено',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    userId: { type: 'integer' },
                    role: { type: 'string' }
                  }
                }
              }
            }
          },
          400: { description: 'Невалідна роль' },
          401: { description: 'Неавторизований доступ' },
          403: { description: 'Доступ заборонено' },
          404: { description: 'Користувача не знайдено' }
        }
      }
    }
  }
};

module.exports = swaggerDocument;
