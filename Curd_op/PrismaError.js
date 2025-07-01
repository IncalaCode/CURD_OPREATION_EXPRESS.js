// u can add otheres  peisam eror code with the message and erorr status 
 exports.ErrorCode = {
      P2002 : {
        errorMessage : 'Unique constraint violation' ,
        statusCode  :  409
      },
      P2003 : {
          errorMessage : 'Foreign key constraint violation' ,
          statusCode  : 400 , 
      } ,
      P2025 : {
          errorMessage  : 'Record not found',
          statusCode  : 404
      }, 
      P2021 : {
          errorMessage :  'Table does not exist',
          statusCode  :  500
      },
      P2022 : {
        errorMessage :  'Column does not exist',
        statusCode :  500
      },
      default : {
        errorMessage :  'server error , unable to to this action ',
        statusCode :  500
      }
    }